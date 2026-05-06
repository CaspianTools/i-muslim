"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/permissions/server";
import {
  amenityInputSchema,
  categoryInputSchema,
  certBodyInputSchema,
  type AmenityInput,
  type CategoryInput,
  type CertBodyInput,
} from "@/lib/businesses/schemas";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorizeAdmin() {
  await requirePermission("businesses.write");
}

function revalidateTaxonomy() {
  revalidatePath("/admin/businesses");
  revalidatePath("/admin/businesses/categories");
  revalidatePath("/admin/businesses/cert-bodies");
  revalidatePath("/admin/businesses/amenities");
  revalidatePath("/businesses");
}

// ---------- Categories ----------

export async function createCategoryAction(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    const ref = await db.collection("categories").add({
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTaxonomy();
    return { ok: true, data: { id: ref.id } };
  } catch (err) {
    console.warn("[actions/business-taxonomies] createCategory failed:", err);
    return { ok: false, error: "Failed to create category" };
  }
}

export async function updateCategoryAction(
  id: string,
  input: CategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("categories").doc(id).set(
      { ...parsed.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidateTaxonomy();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/business-taxonomies] updateCategory failed:", err);
    return { ok: false, error: "Failed to update category" };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("categories").doc(id).delete();
    revalidateTaxonomy();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/business-taxonomies] deleteCategory failed:", err);
    return { ok: false, error: "Failed to delete category" };
  }
}

// ---------- Amenities ----------

export async function createAmenityAction(input: AmenityInput): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  const parsed = amenityInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    const ref = await db.collection("amenityTaxonomy").add({
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTaxonomy();
    return { ok: true, data: { id: ref.id } };
  } catch {
    return { ok: false, error: "Failed to create amenity" };
  }
}

export async function updateAmenityAction(
  id: string,
  input: AmenityInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = amenityInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("amenityTaxonomy").doc(id).set(
      { ...parsed.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidateTaxonomy();
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to update amenity" };
  }
}

export async function deleteAmenityAction(id: string): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("amenityTaxonomy").doc(id).delete();
    revalidateTaxonomy();
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to delete amenity" };
  }
}

// ---------- Certification bodies ----------

export async function createCertBodyAction(input: CertBodyInput): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  const parsed = certBodyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    const ref = await db.collection("certificationBodies").add({
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTaxonomy();
    return { ok: true, data: { id: ref.id } };
  } catch {
    return { ok: false, error: "Failed to create certification body" };
  }
}

export async function updateCertBodyAction(
  id: string,
  input: CertBodyInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = certBodyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("certificationBodies").doc(id).set(
      { ...parsed.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidateTaxonomy();
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to update certification body" };
  }
}

export async function deleteCertBodyAction(id: string): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("certificationBodies").doc(id).delete();
    revalidateTaxonomy();
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to delete certification body" };
  }
}
