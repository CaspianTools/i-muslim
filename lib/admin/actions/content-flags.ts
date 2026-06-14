"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/permissions/server";
import { CONTENT_FLAGS_COLLECTION } from "@/lib/admin/data/content-flags";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function setStatus(
  id: string,
  status: "resolved" | "dismissed",
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requirePermission("flags.moderate");
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
    await db.collection(CONTENT_FLAGS_COLLECTION).doc(id).set(
      {
        status,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: session.email,
      },
      { merge: true },
    );
    revalidatePath("/admin/flags");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: `Failed to ${status === "resolved" ? "resolve" : "dismiss"} flag` };
  }
}

export async function resolveFlagAction(id: string): Promise<ActionResult<{ id: string }>> {
  return setStatus(id, "resolved");
}

export async function dismissFlagAction(id: string): Promise<ActionResult<{ id: string }>> {
  return setStatus(id, "dismissed");
}
