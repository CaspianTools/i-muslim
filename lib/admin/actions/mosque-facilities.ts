"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/permissions/server";
import { MOSQUE_FACILITIES_COLLECTION } from "@/lib/mosques/constants";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const facilityInputSchema = z.object({
  slug: z.string().min(2).max(60).regex(slugRegex, "Slug must be kebab-case (lowercase, hyphens)."),
  name: z.string().min(1).max(80),
  iconKey: z.string().max(40).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export type MosqueFacilityInput = z.infer<typeof facilityInputSchema>;

async function authorizeAdmin() {
  await requirePermission("mosques.write");
}

function revalidate() {
  revalidatePath("/admin/mosques");
  revalidatePath("/admin/mosques/facilities");
  revalidatePath("/mosques");
}

export async function createMosqueFacilityAction(
  input: MosqueFacilityInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  const parsed = facilityInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    // Slug doubles as the doc id so cross-references stay readable and the
    // first-read seed can't accidentally create duplicates if it re-runs.
    const ref = db.collection(MOSQUE_FACILITIES_COLLECTION).doc(parsed.data.slug);
    const existing = await ref.get();
    if (existing.exists) return { ok: false, error: "A facility with this slug already exists." };
    await ref.set({
      slug: parsed.data.slug,
      name: parsed.data.name,
      iconKey: parsed.data.iconKey || null,
      sortOrder: parsed.data.sortOrder ?? 999,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidate();
    return { ok: true, data: { id: parsed.data.slug } };
  } catch (err) {
    console.warn("[actions/mosque-facilities] create failed:", err);
    return { ok: false, error: "Failed to create facility" };
  }
}

export async function updateMosqueFacilityAction(
  id: string,
  input: MosqueFacilityInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = facilityInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection(MOSQUE_FACILITIES_COLLECTION).doc(id).set(
      {
        slug: parsed.data.slug,
        name: parsed.data.name,
        iconKey: parsed.data.iconKey || null,
        sortOrder: parsed.data.sortOrder ?? 999,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    revalidate();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/mosque-facilities] update failed:", err);
    return { ok: false, error: "Failed to update facility" };
  }
}

export async function deleteMosqueFacilityAction(id: string): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection(MOSQUE_FACILITIES_COLLECTION).doc(id).delete();
    revalidate();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/mosque-facilities] delete failed:", err);
    return { ok: false, error: "Failed to delete facility" };
  }
}
