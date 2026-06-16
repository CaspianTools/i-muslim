"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/permissions/server";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { DUAS_SUBCOLLECTION, MAX_DUA_LENGTH } from "@/lib/mosques/duas";

export interface DuaActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function duasCol(db: FirebaseFirestore.Firestore, slug: string) {
  return db.collection(MOSQUES_COLLECTION).doc(slug).collection(DUAS_SUBCOLLECTION);
}

/** Any signed-in member can post a du'a request (instant, length-capped). */
export async function addDua(slug: string, text: string): Promise<DuaActionResult> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };
  const clean = (text ?? "").trim();
  if (clean.length < 1 || clean.length > MAX_DUA_LENGTH) {
    return { ok: false, error: "invalid_text" };
  }
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const ref = await duasCol(db, slug).add({
    text: clean,
    authorUid: session.uid,
    authorName: session.name ?? "",
    madeDuaCount: 0,
    status: "visible",
    createdAt: FieldValue.serverTimestamp(),
  });
  revalidatePath(`/mosques/${slug}`);
  return { ok: true, id: ref.id };
}

/** Toggle "made du'a" for the signed-in user (deduped via `amins/{uid}`). */
export async function makeDua(
  slug: string,
  duaId: string,
): Promise<{ ok: boolean; error?: string; active?: boolean }> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const duaRef = duasCol(db, slug).doc(duaId);
  const aminRef = duaRef.collection("amins").doc(session.uid);
  try {
    const active = await db.runTransaction(async (tx) => {
      const [dua, amin] = await Promise.all([tx.get(duaRef), tx.get(aminRef)]);
      if (!dua.exists) throw new Error("not_found");
      if (amin.exists) {
        tx.delete(aminRef);
        tx.update(duaRef, { madeDuaCount: FieldValue.increment(-1) });
        return false;
      }
      tx.set(aminRef, { uid: session.uid, createdAt: FieldValue.serverTimestamp() });
      tx.update(duaRef, { madeDuaCount: FieldValue.increment(1) });
      return true;
    });
    return { ok: true, active };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** Admin take-down of an inappropriate du'a request. */
export async function takeDownDua(slug: string, duaId: string): Promise<DuaActionResult> {
  await requirePermission("comments.moderate");
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  await duasCol(db, slug).doc(duaId).update({
    status: "taken_down",
    updatedAt: Timestamp.fromDate(new Date()),
  });
  revalidatePath(`/mosques/${slug}`);
  return { ok: true };
}
