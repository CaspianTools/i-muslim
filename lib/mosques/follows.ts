import "server-only";
import { getDb } from "@/lib/firebase/admin";

export const MOSQUE_FOLLOWS_COLLECTION = "mosqueFollows";

/** Deterministic id makes follow/unfollow idempotent and dedupe-free. */
export function followDocId(uid: string, slug: string): string {
  return `${uid}__${slug}`;
}

export async function isFollowingMosque(uid: string, slug: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const doc = await db.collection(MOSQUE_FOLLOWS_COLLECTION).doc(followDocId(uid, slug)).get();
    return doc.exists;
  } catch {
    return false;
  }
}

/** Uids of users who follow a given masjid (for push fan-out). */
export async function listFollowerUids(slug: string, limit = 1000): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection(MOSQUE_FOLLOWS_COLLECTION)
      .where("mosqueSlug", "==", slug)
      .limit(limit)
      .get();
    return snap.docs.map((d) => (d.data().uid as string) ?? "").filter((u) => u.length > 0);
  } catch (err) {
    console.warn("[mosqueFollows] follower list failed:", err);
    return [];
  }
}

export async function listFollowedSlugs(uid: string, limit = 200): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection(MOSQUE_FOLLOWS_COLLECTION)
      .where("uid", "==", uid)
      .limit(limit)
      .get();
    return snap.docs
      .map((d) => (d.data().mosqueSlug as string) ?? "")
      .filter((s) => s.length > 0);
  } catch (err) {
    console.warn("[mosqueFollows] list failed:", err);
    return [];
  }
}
