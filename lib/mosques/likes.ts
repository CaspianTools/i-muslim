import "server-only";
import { getDb } from "@/lib/firebase/admin";

export const MOSQUE_LIKES_COLLECTION = "mosqueLikes";

/** Deterministic id makes like/unlike idempotent and dedupe-free. */
export function likeDocId(uid: string, slug: string): string {
  return `${uid}__${slug}`;
}

export async function isLikingMosque(uid: string, slug: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const doc = await db.collection(MOSQUE_LIKES_COLLECTION).doc(likeDocId(uid, slug)).get();
    return doc.exists;
  } catch {
    return false;
  }
}
