"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import { getDb } from "@/lib/firebase/admin";
import {
  MOSQUES_COLLECTION,
  MOSQUE_SUBMISSIONS_COLLECTION,
  emptyServices,
} from "@/lib/mosques/constants";
import { buildMosqueSlug, isReservedSlug, withCollisionSuffix } from "@/lib/mosques/slug";
import { buildSearchTokens } from "@/lib/mosques/search";
import { geohashFor } from "@/lib/mosques/geo";
import { defaultPrayerCalc } from "@/lib/mosques/adhan";
import type { Mosque, MosqueServices, MosqueStatus } from "@/types/mosque";
import { Timestamp } from "firebase-admin/firestore";

const localizedSchema = z.object({
  en: z.string().min(2),
  ar: z.string().optional().or(z.literal("")),
  tr: z.string().optional().or(z.literal("")),
  id: z.string().optional().or(z.literal("")),
});

const iqamahSchema = z
  .union([
    z.object({ mode: z.literal("offset"), minutesAfterAdhan: z.number().int().min(-30).max(120) }),
    z.object({ mode: z.literal("fixed"), time: z.string().regex(/^\d{1,2}:\d{2}$/) }),
  ])
  .optional();

const mosqueInputSchema = z.object({
  name: localizedSchema,
  legalName: z.string().optional(),
  denomination: z.enum(["sunni", "shia", "ibadi", "ahmadi", "other", "unspecified"]),
  description: localizedSchema.partial({ en: true }).optional(),
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
  services: z
    .object({
      fridayPrayer: z.boolean(),
      womenSection: z.boolean(),
      wuduFacilities: z.boolean(),
      wheelchairAccess: z.boolean(),
      parking: z.boolean(),
      quranClasses: z.boolean(),
      library: z.boolean(),
      funeralServices: z.boolean(),
      nikahServices: z.boolean(),
      accommodatesItikaf: z.boolean(),
    })
    .partial()
    .optional(),
  languages: z.array(z.string()).default([]),
  altSpellings: z.array(z.string()).optional(),
  prayerCalc: z
    .object({
      method: z.enum(["MWL", "ISNA", "EGYPT", "MAKKAH", "KARACHI", "TEHRAN", "JAFARI"]),
      asrMethod: z.enum(["shafi", "hanafi"]),
      highLatitudeRule: z.enum(["MIDDLE_OF_NIGHT", "ANGLE_BASED", "ONE_SEVENTH"]),
    })
    .optional(),
  iqamah: z
    .object({
      fajr: iqamahSchema,
      dhuhr: iqamahSchema,
      jumuah: iqamahSchema,
      asr: iqamahSchema,
      maghrib: iqamahSchema,
      isha: iqamahSchema,
    })
    .optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["draft", "pending_review", "published", "suspended"]).default("draft"),
});

export type MosqueInput = z.infer<typeof mosqueInputSchema>;

export interface ActionResult {
  ok: boolean;
  slug?: string;
  error?: string;
  message?: string;
}

function trimmedLocalized(input: MosqueInput["name"] | NonNullable<MosqueInput["description"]>): Mosque["name"] {
  const out: Mosque["name"] = { en: (input.en ?? "").trim() };
  if (input.ar) out.ar = String(input.ar).trim();
  if (input.tr) out.tr = String(input.tr).trim();
  if (input.id) out.id = String(input.id).trim();
  return out;
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
  const services: MosqueServices = { ...emptyServices(), ...(input.services as Partial<MosqueServices> ?? {}) };
  const citySlug = citySlugFor(input.city);
  const countrySlug = input.country.toLowerCase();
  const partial = {
    name: trimmedLocalized(input.name),
    city: input.city,
    country: input.country.toUpperCase(),
    altSpellings: input.altSpellings,
    languages: input.languages ?? [],
    denomination: input.denomination,
    address: input.address,
  };
  const iqamah = stripUndefinedIqamah(input.iqamah);
  return {
    slug,
    status: input.status,
    name: partial.name,
    legalName: input.legalName?.trim() || undefined,
    denomination: input.denomination,
    description: input.description ? trimmedLocalized({ en: input.description.en ?? "", ar: input.description.ar, tr: input.description.tr, id: input.description.id }) : undefined,
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
    services,
    languages: input.languages ?? [],
    prayerCalc: input.prayerCalc ?? defaultPrayerCalc(),
    iqamah: iqamah && Object.keys(iqamah).length > 0 ? iqamah : undefined,
    coverImage: input.coverImageUrl ? { url: input.coverImageUrl } : undefined,
    logoUrl: input.logoUrl || undefined,
    submittedBy: { uid, email },
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

function stripUndefinedIqamah(iqamah: MosqueInput["iqamah"]): Mosque["iqamah"] | undefined {
  if (!iqamah) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(iqamah)) {
    if (v) out[k] = v;
  }
  return out as Mosque["iqamah"];
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
  const session = await requireAdminSession();
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
  const session = await requireAdminSession();
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
  const session = await requireAdminSession();
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
  await requireAdminSession();
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  await db.collection(MOSQUES_COLLECTION).doc(slug).delete();
  revalidatePath("/mosques");
  revalidatePath(`/mosques/${slug}`);
  revalidatePath("/admin/mosques");
  return { ok: true, slug };
}

export async function rejectSubmission(submissionId: string, reason: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  const ref = db.collection(MOSQUE_SUBMISSIONS_COLLECTION).doc(submissionId);
  await ref.update({
    status: "rejected",
    decidedBy: session.uid,
    decidedAt: Timestamp.now(),
    rejectionReason: reason,
  });
  revalidatePath("/admin/mosques");
  return { ok: true };
}

export async function promoteSubmission(submissionId: string): Promise<ActionResult> {
  const session = await requireAdminSession();
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const subRef = db.collection(MOSQUE_SUBMISSIONS_COLLECTION).doc(submissionId);
  const subSnap = await subRef.get();
  if (!subSnap.exists) return { ok: false, error: "not_found" };
  const submission = subSnap.data() ?? {};
  const payload = submission.payload as Partial<MosqueInput> | undefined;
  if (!payload || !payload.name?.en || !payload.city || !payload.country || !payload.location) {
    return { ok: false, error: "invalid_submission" };
  }

  const result = await createMosque({ ...payload, status: "published" });
  if (!result.ok) return result;

  await subRef.update({
    status: "approved",
    decidedBy: session.uid,
    decidedAt: Timestamp.now(),
    promotedSlug: result.slug,
  });
  revalidatePath("/admin/mosques");
  return result;
}

export async function bulkImport(rows: unknown[]): Promise<{ ok: boolean; created: number; failed: number; errors: string[] }> {
  await requireAdminSession();
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
