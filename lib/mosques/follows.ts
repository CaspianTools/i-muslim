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

export interface MosqueMember {
  uid: string;
  name: string;
  avatarUrl: string | null;
}

/** Recent followers of a masjid, joined to their user profile (for the members rail). */
export async function listRecentFollowers(slug: string, limit = 8): Promise<MosqueMember[]> {
  const db = getDb();
  if (!db) return [];
  const uids = await listFollowerUids(slug, limit);
  if (uids.length === 0) return [];
  try {
    const refs = uids.map((uid) => db.collection("users").doc(uid));
    const snaps = await db.getAll(...refs);
    return snaps.map((snap, i) => {
      const d = snap.data() ?? {};
      const name = ((d.displayName as string) || (d.name as string) || "").trim();
      return { uid: uids[i]!, name, avatarUrl: (d.avatarUrl as string) ?? null };
    });
  } catch (err) {
    console.warn("[mosqueFollows] member profiles read failed:", err);
    return uids.map((uid) => ({ uid, name: "", avatarUrl: null }));
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
