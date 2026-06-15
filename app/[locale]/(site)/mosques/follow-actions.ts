"use server";

import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { MOSQUE_FOLLOWS_COLLECTION, followDocId } from "@/lib/mosques/follows";

export async function toggleMosqueFollow(
  slug: string,
): Promise<{ ok: boolean; error?: string; following?: boolean }> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const followRef = db.collection(MOSQUE_FOLLOWS_COLLECTION).doc(followDocId(session.uid, slug));
  const mosqueRef = db.collection(MOSQUES_COLLECTION).doc(slug);
  try {
    const following = await db.runTransaction(async (tx) => {
      const snap = await tx.get(followRef);
      if (snap.exists) {
        tx.delete(followRef);
        tx.update(mosqueRef, { followerCount: FieldValue.increment(-1) });
        return false;
      }
      tx.set(followRef, {
        uid: session.uid,
        mosqueSlug: slug,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(mosqueRef, { followerCount: FieldValue.increment(1) });
      return true;
    });
    return { ok: true, following };
  } catch {
    return { ok: false, error: "failed" };
  }
}
