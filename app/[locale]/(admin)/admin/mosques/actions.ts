"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions/server";
import { getAdminAuth, getDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { buildMosqueSlug, isReservedSlug, withCollisionSuffix } from "@/lib/mosques/slug";
import { buildSearchTokens } from "@/lib/mosques/search";
import { geohashFor } from "@/lib/mosques/geo";
import { defaultPrayerCalc, suggestPrayerCalc } from "@/lib/mosques/adhan";
import {
  createMosqueUploadUrl,
  deleteMosqueStorageObject,
  type MosqueUploadInput,
} from "@/lib/mosques/storage";
import type { Mosque, MosqueStatus } from "@/types/mosque";
import { Timestamp } from "firebase-admin/firestore";

// Mosque names/descriptions are English-only in the UI; `ar` is the optional
// canonical Arabic name (not a translation). Other locales fall back to `en`
// via the i18n deep-merge in `i18n/request.ts`.
const nameSchema = z.object({
  en: z.string().min(2),
  ar: z.string().optional().or(z.literal("")),
});

const descriptionSchema = z
  .object({ en: z.string().optional().or(z.literal("")) })
  .optional();

const mosqueInputSchema = z.object({
  name: nameSchema,
  legalName: z.string().optional(),
  denomination: z.enum(["sunni", "shia", "ibadi", "ahmadi", "other", "unspecified"]),
  description: descriptionSchema,
  address: z.object({
    line1: z.string().min(2),
    line2: z.string().optional(),
    postalCode: z.string().optional(),
  }),
  city: z.string().min(1),
  region: z.string().optional(),
  country: z.string().length(2).regex(/^[A-Za-z]{2}$/),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  timezone: z.string().min(2),
  contact: z
    .object({
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      website: z.string().url().optional().or(z.literal("")),
    })
    .optional(),
  social: z
    .object({
      facebook: z.string().url().optional().or(z.literal("")),
      instagram: z.string().url().optional().or(z.literal("")),
      youtube: z.string().url().optional().or(z.literal("")),
      whatsapp: z.string().optional(),
    })
    .optional(),
  capacity: z.number().int().nonnegative().optional(),
  facilities: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  altSpellings: z.array(z.string()).optional(),
  prayerCalc: z
    .object({
      method: z.enum(["MWL", "ISNA", "EGYPT", "MAKKAH", "KARACHI", "TEHRAN", "JAFARI"]),
      asrMethod: z.enum(["shafi", "hanafi"]),
      highLatitudeRule: z.enum(["MIDDLE_OF_NIGHT", "ANGLE_BASED", "ONE_SEVENTH"]),
    })
    .optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  coverImageStoragePath: z.string().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  logoStoragePath: z.string().optional().or(z.literal("")),
  status: z
    .enum(["draft", "pending_review", "published", "rejected", "suspended"])
    .default("draft"),
  /**
   * Firebase Auth uids of users authorized to manage this mosque (e.g. create
   * events on its behalf via the public submit flow). Site admins assign these
   * after off-platform identity verification. Empty array clears all managers.
   */
  managers: z.array(z.string().min(1)).optional(),
});

export type MosqueInput = z.infer<typeof mosqueInputSchema>;

export interface ActionResult {
  ok: boolean;
  slug?: string;
  error?: string;
  message?: string;
}

function trimmedName(input: MosqueInput["name"]): Mosque["name"] {
  const out: Mosque["name"] = { en: (input.en ?? "").trim() };
  if (input.ar) out.ar = String(input.ar).trim();
  return out;
}

function trimmedDescription(
  input: NonNullable<MosqueInput["description"]>,
): Mosque["description"] | undefined {
  const en = (input.en ?? "").trim();
  if (!en) return undefined;
  return { en };
}

function citySlugFor(city: string): string {
  return city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "city";
}

async function nextSlug(base: string): Promise<string> {
  const db = getDb();
  if (!db) {
    if (isReservedSlug(base)) return `${base}-2`;
    return base;
  }
  const taken = new Set<string>();
  const baseDoc = await db.collection(MOSQUES_COLLECTION).doc(base).get();
  if (baseDoc.exists) taken.add(base);
  for (let i = 2; i <= 5; i += 1) {
    const probe = `${base}-${i}`;
    const d = await db.collection(MOSQUES_COLLECTION).doc(probe).get();
    if (d.exists) taken.add(probe);
  }
  return withCollisionSuffix(base, taken);
}

function buildPersistable(
  input: MosqueInput,
  slug: string,
  uid: string,
  email: string,
  now: Date,
  publishedAt?: Date,
): Record<string, unknown> {
  const citySlug = citySlugFor(input.city);
  const countrySlug = input.country.toLowerCase();
  const partial = {
    name: trimmedName(input.name),
    city: input.city,
    country: input.country.toUpperCase(),
    altSpellings: input.altSpellings,
    languages: input.languages ?? [],
    denomination: input.denomination,
    address: input.address,
  };
  return {
    slug,
    status: input.status,
    name: partial.name,
    legalName: input.legalName?.trim() || undefined,
    denomination: input.denomination,
    description: input.description ? trimmedDescription(input.description) : undefined,
    address: input.address,
    city: input.city,
    citySlug,
    region: input.region?.trim() || undefined,
    country: input.country.toUpperCase(),
    countrySlug,
    location: input.location,
    geohash: geohashFor(input.location.lat, input.location.lng),
    timezone: input.timezone,
    contact: cleanObject(input.contact),
    social: cleanObject(input.social),
    capacity: input.capacity,
    // The `services` boolean map is no longer written. New records persist
    // facility selections under the unified `facilities[]` slug array.
    facilities: input.facilities ?? [],
    languages: input.languages ?? [],
    prayerCalc:
      input.prayerCalc ?? suggestPrayerCalc(partial.country, input.denomination) ?? defaultPrayerCalc(),
    coverImage: input.coverImageUrl
      ? {
          url: input.coverImageUrl,
          ...(input.coverImageStoragePath ? { storagePath: input.coverImageStoragePath } : {}),
        }
      : undefined,
    logoUrl: input.logoUrl || undefined,
    logoStoragePath: input.logoStoragePath || undefined,
    submittedBy: { uid, email },
    managers: input.managers ?? [],
    moderation: {
      reviewedBy: uid,
      reviewedAt: now.toISOString(),
    },
    searchTokens: buildSearchTokens(partial),
    altSpellings: input.altSpellings,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    publishedAt: publishedAt ? Timestamp.fromDate(publishedAt) : undefined,
  };
}

function cleanObject<T extends Record<string, unknown> | undefined>(obj: T): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return Object.keys(out).length > 0 ? (out as T) : undefined;
}

function stripUndefinedTopLevel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export async function createMosque(rawInput: unknown): Promise<ActionResult> {
  const session = await requirePermission("mosques.write");
  const parsed = mosqueInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const input = parsed.data;

  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const baseSlug = buildMosqueSlug(input.name.en, citySlugFor(input.city));
  const slug = await nextSlug(baseSlug);
  const now = new Date();
  const publishedAt = input.status === "published" ? now : undefined;
  const data = stripUndefinedTopLevel(
    buildPersistable(input, slug, session.uid, session.email, now, publishedAt),
  );

  await db.collection(MOSQUES_COLLECTION).doc(slug).set(data, { merge: false });
  revalidatePath("/mosques");
  revalidatePath(`/mosques/${slug}`);
  revalidatePath(`/mosques/c/${input.country.toLowerCase()}`);
  revalidatePath("/admin/mosques");
  return { ok: true, slug };
}

export async function updateMosque(slug: string, rawInput: unknown): Promise<ActionResult> {
  const session = await requirePermission("mosques.write");
  const parsed = mosqueInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  const input = parsed.data;
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const ref = db.collection(MOSQUES_COLLECTION).doc(slug);
  const existing = await ref.get();
  if (!existing.exists) return { ok: false, error: "not_found" };
  const prev = existing.data() ?? {};
  const now = new Date();
  const wasPublished = prev.status === "published";
  const willPublish = input.status === "published";
  const publishedAt = willPublish
    ? wasPublished
      ? (prev.publishedAt as Timestamp | undefined)?.toDate?.() ?? now
      : now
    : undefined;
  const data = stripUndefinedTopLevel(
    buildPersistable(input, slug, session.uid, session.email, now, publishedAt),
  );
  // Preserve createdAt
  if (prev.createdAt) data.createdAt = prev.createdAt;

  await ref.set(data, { merge: false });
  revalidatePath("/mosques");
  revalidatePath(`/mosques/${slug}`);
  revalidatePath(`/mosques/c/${input.country.toLowerCase()}`);
  revalidatePath(`/mosques/c/${input.country.toLowerCase()}/${citySlugFor(input.city)}`);
  revalidatePath("/admin/mosques");
  return { ok: true, slug };
}

export async function setMosqueStatus(slug: string, status: MosqueStatus): Promise<ActionResult> {
  const session = await requirePermission("mosques.publish");
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  const ref = db.collection(MOSQUES_COLLECTION).doc(slug);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "not_found" };
  const now = new Date();
  const update: Record<string, unknown> = {
    status,
    updatedAt: Timestamp.fromDate(now),
    "moderation.reviewedBy": session.uid,
    "moderation.reviewedAt": now.toISOString(),
  };
  if (status === "published" && !(snap.data() ?? {}).publishedAt) {
    update.publishedAt = Timestamp.fromDate(now);
  }
  await ref.update(update);
  revalidatePath("/mosques");
  revalidatePath(`/mosques/${slug}`);
  revalidatePath("/admin/mosques");
  return { ok: true, slug };
}

export async function deleteMosque(slug: string): Promise<ActionResult> {
  await requirePermission("mosques.write");
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  await db.collection(MOSQUES_COLLECTION).doc(slug).delete();
  revalidatePath("/mosques");
  revalidatePath(`/mosques/${slug}`);
  revalidatePath("/admin/mosques");
  return { ok: true, slug };
}

export async function rejectMosque(slug: string, reason: string): Promise<ActionResult> {
  const session = await requirePermission("mosques.publish");
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  const ref = db.collection(MOSQUES_COLLECTION).doc(slug);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "not_found" };
  const now = new Date();
  await ref.update({
    status: "rejected",
    updatedAt: Timestamp.fromDate(now),
    "moderation.reviewedBy": session.uid,
    "moderation.reviewedAt": now.toISOString(),
    "moderation.rejectionReason": reason,
  });
  revalidatePath("/admin/mosques");
  return { ok: true, slug };
}

export async function getMosqueUploadUrlAction(
  input: MosqueUploadInput,
): Promise<
  | { ok: true; data: { url: string; storagePath: string; expiresAt: string } }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("mosques.write");
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (!input.slug) return { ok: false, error: "missing_slug" };
  try {
    const result = await createMosqueUploadUrl(input);
    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create upload URL";
    return { ok: false, error: msg };
  }
}

export async function deleteMosqueImageAction(
  storagePath: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePermission("mosques.write");
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (!storagePath) return { ok: false, error: "missing_path" };
  // Best-effort: orphaned blobs are tolerable; missing the delete must not
  // block the form save flow.
  await deleteMosqueStorageObject(storagePath);
  return { ok: true };
}

/**
 * Resolve an email address to a Firebase Auth uid. Used by the mosque editor
 * to let admins add managers by email rather than raw uid. Returns { ok: false,
 * error: "not_found" } when no user has signed up with that email yet.
 */
export async function lookupUserByEmailAction(
  email: string,
): Promise<
  | { ok: true; data: { uid: string; email: string; displayName: string | null } }
  | { ok: false; error: string }
> {
  try {
    await requirePermission("mosques.write");
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  const trimmed = email.trim().toLowerCase();
  if (!/^.+@.+\..+$/.test(trimmed)) return { ok: false, error: "invalid_email" };
  const auth = getAdminAuth();
  if (!auth) return { ok: false, error: "auth_not_configured" };
  try {
    const user = await auth.getUserByEmail(trimmed);
    return {
      ok: true,
      data: {
        uid: user.uid,
        email: user.email ?? trimmed,
        displayName: user.displayName ?? null,
      },
    };
  } catch {
    return { ok: false, error: "not_found" };
  }
}

export async function bulkImport(rows: unknown[]): Promise<{ ok: boolean; created: number; failed: number; errors: string[] }> {
  await requirePermission("mosques.write");
  const db = getDb();
  if (!db) return { ok: false, created: 0, failed: rows.length, errors: ["firestore_not_configured"] };

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const result = await createMosque(row).catch((err) => ({ ok: false, error: err instanceof Error ? err.message : "unknown" } as ActionResult));
    if (result.ok) created += 1;
    else {
      failed += 1;
      if (errors.length < 10) errors.push(result.error ?? "unknown");
    }
  }
  revalidatePath("/admin/mosques");
  revalidatePath("/mosques");
  return { ok: failed === 0, created, failed, errors };
}
