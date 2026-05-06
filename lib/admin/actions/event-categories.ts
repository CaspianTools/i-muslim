"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/permissions/server";
import {
  eventCategoryInputSchema,
  type EventCategoryInput,
} from "@/lib/events/admin-schemas";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const COLLECTION = "eventCategories";

async function authorizeAdmin() {
  await requirePermission("events.write");
}

function revalidate() {
  revalidatePath("/admin/events");
  revalidatePath("/admin/events/categories");
  revalidatePath("/events");
  revalidatePath("/events/submit");
}

export async function createEventCategoryAction(
  input: EventCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  const parsed = eventCategoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    const ref = await db.collection(COLLECTION).add({
      ...parsed.data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidate();
    return { ok: true, data: { id: ref.id } };
  } catch (err) {
    console.warn("[actions/event-categories] create failed:", err);
    return { ok: false, error: "Failed to create category" };
  }
}

export async function updateEventCategoryAction(
  id: string,
  input: EventCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = eventCategoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection(COLLECTION).doc(id).set(
      { ...parsed.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidate();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/event-categories] update failed:", err);
    return { ok: false, error: "Failed to update category" };
  }
}

export async function deleteEventCategoryAction(id: string): Promise<ActionResult<{ id: string }>> {
  try { await authorizeAdmin(); } catch { return { ok: false, error: "Unauthorized" }; }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection(COLLECTION).doc(id).delete();
    revalidate();
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/event-categories] delete failed:", err);
    return { ok: false, error: "Failed to delete category" };
  }
}
