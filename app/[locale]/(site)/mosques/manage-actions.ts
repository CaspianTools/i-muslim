"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { canManageMosque } from "@/lib/mosques/authz";
import {
  createMosqueUploadUrl,
  publicUrlFor,
  finalizeMosquePublicUrl,
  type MosqueUploadKind,
} from "@/lib/mosques/storage";

export interface ManageResult {
  ok: boolean;
  error?: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const contactSchema = z.object({
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
});

// Social values may be a full URL or a bare handle (e.g. "luivante"), so we
// validate leniently as a short string; ContactRailCard builds the real href.
const socialValue = z.string().trim().max(200).optional().or(z.literal(""));
const socialSchema = z.object({
  instagram: socialValue,
  facebook: socialValue,
  youtube: socialValue,
  x: socialValue,
  tiktok: socialValue,
  telegram: socialValue,
  whatsapp: socialValue,
  website: socialValue,
});

const iqamahSchema = z.object({
  fajr: z.string().regex(TIME_RE).optional().or(z.literal("")),
  dhuhr: z.string().regex(TIME_RE).optional().or(z.literal("")),
  asr: z.string().regex(TIME_RE).optional().or(z.literal("")),
  maghrib: z.string().regex(TIME_RE).optional().or(z.literal("")),
  isha: z.string().regex(TIME_RE).optional().or(z.literal("")),
  jumuah: z.array(z.string().regex(TIME_RE)).max(4).optional(),
});

async function authorize(slug: string): Promise<boolean> {
  return canManageMosque(slug);
}

function cleanStrings<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) out[k] = trimmed;
    } else if (Array.isArray(v)) {
      const arr = v.filter((x) => typeof x === "string" && x.trim());
      if (arr.length) out[k] = arr;
    } else if (v !== undefined && v !== null) {
      out[k] = v;
    }
  }
  return out as Partial<T>;
}

async function updateFields(slug: string, fields: Record<string, unknown>): Promise<ManageResult> {
  if (!(await authorize(slug))) return { ok: false, error: "forbidden" };
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  const ref = db.collection(MOSQUES_COLLECTION).doc(slug);
  if (!(await ref.get()).exists) return { ok: false, error: "not_found" };
  await ref.update({ ...fields, updatedAt: Timestamp.fromDate(new Date()) });
  revalidatePath(`/mosques/${slug}`);
  return { ok: true };
}

export async function updateMosqueAbout(slug: string, about: string): Promise<ManageResult> {
  const trimmed = about.trim().slice(0, 2000);
  return updateFields(slug, { about: trimmed || null });
}

export async function updateMosqueContact(slug: string, raw: unknown): Promise<ManageResult> {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  return updateFields(slug, { contact: cleanStrings(parsed.data) });
}

export async function updateMosqueSocial(slug: string, raw: unknown): Promise<ManageResult> {
  const parsed = socialSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  return updateFields(slug, { social: cleanStrings(parsed.data) });
}

export async function updateMosqueIqamah(slug: string, raw: unknown): Promise<ManageResult> {
  const parsed = iqamahSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  return updateFields(slug, { iqamah: cleanStrings(parsed.data) });
}

/** Manager-gated upload URL for logo/cover/news images on a mosque they manage. */
export async function getManageUploadUrlAction(input: {
  slug: string;
  kind: Extract<MosqueUploadKind, "logo" | "cover" | "news">;
  filename: string;
  contentType: string;
  contentLength: number;
}): Promise<{ ok: boolean; error?: string; url?: string; storagePath?: string; publicUrl?: string }> {
  if (!(await authorize(input.slug))) return { ok: false, error: "forbidden" };
  try {
    const result = await createMosqueUploadUrl({
      slug: input.slug,
      kind: input.kind,
      filename: input.filename,
      contentType: input.contentType,
      contentLength: input.contentLength,
    });
    return { ok: true, url: result.url, storagePath: result.storagePath, publicUrl: publicUrlFor(result.storagePath) };
  } catch (err) {
    console.warn("[mosques/manage] upload url failed:", err);
    return { ok: false, error: "upload_url_failed" };
  }
}

/**
 * Called by the client after it PUTs a file to the signed upload URL. Stamps a
 * Firebase download token on the object and returns a permanent media URL that
 * renders regardless of the bucket's public-access policy.
 */
export async function finalizeMosqueUploadAction(
  slug: string,
  storagePath: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!(await authorize(slug))) return { ok: false, error: "forbidden" };
  // Defense in depth: only finalize public-media objects under a mosque folder,
  // never proof docs (those stay private behind admin-only signed reads).
  if (!storagePath.startsWith("mosques/") || storagePath.includes("/proof/")) {
    return { ok: false, error: "bad_path" };
  }
  try {
    return { ok: true, url: await finalizeMosquePublicUrl(storagePath) };
  } catch (err) {
    console.warn("[mosques/manage] finalize failed:", err);
    return { ok: false, error: "finalize_failed" };
  }
}

export async function updateMosqueLogo(
  slug: string,
  image: { url: string; storagePath: string } | null,
): Promise<ManageResult> {
  if (image) {
    return updateFields(slug, { logoUrl: image.url, logoStoragePath: image.storagePath });
  }
  return updateFields(slug, { logoUrl: null, logoStoragePath: null });
}

export async function updateMosqueCover(
  slug: string,
  image: { url: string; storagePath: string } | null,
): Promise<ManageResult> {
  return updateFields(slug, {
    coverImage: image ? { url: image.url, storagePath: image.storagePath } : null,
  });
}

/**
 * Go-live gate (decision #13): a manager flips their `claimed_draft` page public
 * once the essentials are present. Identity fields (name, location) stay admin-
 * controlled, so a registered masjid awaiting an admin-set location can't publish
 * with a 0,0 pin.
 */
export async function publishMosque(slug: string): Promise<ManageResult & { missing?: string[] }> {
  if (!(await authorize(slug))) return { ok: false, error: "forbidden" };
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  const ref = db.collection(MOSQUES_COLLECTION).doc(slug);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "not_found" };
  const data = snap.data() ?? {};

  const missing: string[] = [];
  if (!data.logoUrl) missing.push("logo");
  if (!data.about || String(data.about).trim().length < 10) missing.push("about");
  const loc = data.location as { lat?: number; lng?: number } | undefined;
  if (!loc || (loc.lat === 0 && loc.lng === 0)) missing.push("location");
  if (missing.length > 0) return { ok: false, error: "incomplete", missing };

  const now = new Date();
  await ref.update({
    status: "published",
    publishedAt: data.publishedAt ?? Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });
  revalidatePath(`/mosques/${slug}`);
  revalidatePath("/mosques");
  return { ok: true };
}
