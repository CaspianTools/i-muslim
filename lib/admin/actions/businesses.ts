"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/permissions/server";
import { businessInputSchema, type BusinessInput } from "@/lib/businesses/schemas";
import { slugify, withCollisionSuffix, buildSearchTokens } from "@/lib/businesses/slug";
import { createUploadUrl, deleteStorageObject } from "@/lib/businesses/storage";
import { normalizeBusiness } from "@/lib/admin/data/businesses";
import type { Business } from "@/types/business";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof Timestamp)) {
      const nested = stripUndefined(v as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

function toFirestorePayload(input: BusinessInput, slug: string) {
  const tokens = buildSearchTokens(input.name, input.address.city);
  return stripUndefined({
    slug,
    status: input.status,
    source: "admin" as const,
    name: input.name,
    description: input.description,
    categoryIds: input.categoryIds,
    halal: {
      ...input.halal,
      expiresAt: input.halal.expiresAt ? new Date(input.halal.expiresAt) : undefined,
    },
    muslimOwned: input.muslimOwned,
    platformVerifiedAt: input.platformVerifiedAt ? new Date(input.platformVerifiedAt) : undefined,
    contact: input.contact,
    address: input.address,
    hours: input.hours,
    amenityIds: input.amenityIds,
    priceTier: input.priceTier,
    photos: input.photos,
    ownerEmail: input.ownerEmail,
    searchTokens: tokens,
  });
}

function revalidateAdmin() {
  revalidatePath("/admin/businesses");
  revalidatePath("/businesses");
}

async function authorizeAdmin() {
  return await requirePermission("businesses.write");
}

async function reserveSlug(
  db: FirebaseFirestore.Firestore,
  baseSlug: string,
): Promise<{ ref: FirebaseFirestore.DocumentReference; slug: string }> {
  const businessRef = db.collection("businesses").doc();
  const businessId = businessRef.id;
  let attempt = 1;
  let slug = baseSlug;
  for (; attempt <= 25; attempt += 1) {
    slug = withCollisionSuffix(baseSlug, attempt);
    const candidate = slug;
    const reserved = await db.runTransaction(async (tx) => {
      const slugRef = db.collection("slugs").doc(candidate);
      const slugSnap = await tx.get(slugRef);
      if (slugSnap.exists) return false;
      tx.set(slugRef, {
        businessId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (reserved) return { ref: businessRef, slug };
  }
  throw new Error(`Could not reserve slug after ${attempt} attempts`);
}

export async function createBusinessAction(input: BusinessInput): Promise<ActionResult<Business>> {
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const parsed = businessInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const baseSlug = slugify(parsed.data.name, parsed.data.address.city);
    const { ref, slug } = await reserveSlug(db, baseSlug);
    const payload = toFirestorePayload(parsed.data, slug);
    await ref.set({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: parsed.data.status === "published" ? FieldValue.serverTimestamp() : null,
    });
    const snap = await ref.get();
    const created = normalizeBusiness(ref.id, snap.data() as Record<string, unknown>);
    if (!created) return { ok: false, error: "Failed to read back created business" };
    revalidateAdmin();
    return { ok: true, data: created };
  } catch (err) {
    console.warn("[admin/actions/businesses] create failed:", err);
    return { ok: false, error: "Failed to create business" };
  }
}

export async function updateBusinessAction(
  id: string,
  input: BusinessInput,
): Promise<ActionResult<Business>> {
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = businessInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const ref = db.collection("businesses").doc(id);
    const existing = await ref.get();
    if (!existing.exists) return { ok: false, error: "Business not found" };
    const existingData = existing.data() as Record<string, unknown>;
    const existingSlug = typeof existingData.slug === "string" ? existingData.slug : undefined;
    if (!existingSlug) return { ok: false, error: "Existing business has no slug" };
    const wasPublished = existingData.status === "published";

    const payload = toFirestorePayload(parsed.data, existingSlug);
    await ref.set(
      {
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt:
          parsed.data.status === "published" && !wasPublished
            ? FieldValue.serverTimestamp()
            : (existingData.publishedAt ?? null),
      },
      { merge: true },
    );
    const snap = await ref.get();
    const updated = normalizeBusiness(ref.id, snap.data() as Record<string, unknown>);
    if (!updated) return { ok: false, error: "Failed to read back business" };
    revalidateAdmin();
    revalidatePath(`/businesses/${updated.slug}`);
    return { ok: true, data: updated };
  } catch (err) {
    console.warn("[admin/actions/businesses] update failed:", err);
    return { ok: false, error: "Failed to update business" };
  }
}

export async function archiveBusinessAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };

  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const ref = db.collection("businesses").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: "Business not found" };
    await ref.set(
      { status: "archived", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidateAdmin();
    const data = snap.data() as Record<string, unknown>;
    if (typeof data.slug === "string") revalidatePath(`/businesses/${data.slug}`);
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[admin/actions/businesses] archive failed:", err);
    return { ok: false, error: "Failed to archive business" };
  }
}

export async function restoreBusinessAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };

  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }

  try {
    const ref = db.collection("businesses").doc(id);
    await ref.set(
      { status: "draft", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidateAdmin();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[admin/actions/businesses] restore failed:", err);
    return { ok: false, error: "Failed to restore business" };
  }
}

export interface UploadUrlActionInput {
  businessId: string;
  filename: string;
  contentType: string;
  contentLength: number;
}

export async function getBusinessUploadUrlAction(
  input: UploadUrlActionInput,
): Promise<ActionResult<{ url: string; storagePath: string; expiresAt: string }>> {
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!input.businessId) return { ok: false, error: "Missing businessId" };
  try {
    const result = await createUploadUrl(input);
    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create upload URL";
    return { ok: false, error: msg };
  }
}

export async function deleteBusinessPhotoAction(
  businessId: string,
  storagePath: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!businessId || !storagePath) return { ok: false, error: "Missing input" };
  try {
    await deleteStorageObject(storagePath);
    return { ok: true, data: { ok: true } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete photo";
    return { ok: false, error: msg };
  }
}
