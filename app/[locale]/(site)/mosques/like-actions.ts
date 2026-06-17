"use server";

import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { MOSQUE_LIKES_COLLECTION, likeDocId } from "@/lib/mosques/likes";

/** Toggle a masjid-level "like" (heart) for the signed-in user. */
export async function toggleMosqueLike(
  slug: string,
): Promise<{ ok: boolean; error?: string; liked?: boolean }> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const likeRef = db.collection(MOSQUE_LIKES_COLLECTION).doc(likeDocId(session.uid, slug));
  const mosqueRef = db.collection(MOSQUES_COLLECTION).doc(slug);
  try {
    const liked = await db.runTransaction(async (tx) => {
      const snap = await tx.get(likeRef);
      if (snap.exists) {
        tx.delete(likeRef);
        tx.update(mosqueRef, { likeCount: FieldValue.increment(-1) });
        return false;
      }
      tx.set(likeRef, { uid: session.uid, mosqueSlug: slug, createdAt: FieldValue.serverTimestamp() });
      tx.update(mosqueRef, { likeCount: FieldValue.increment(1) });
      return true;
    });
    return { ok: true, liked };
  } catch {
    return { ok: false, error: "failed" };
  }
}
