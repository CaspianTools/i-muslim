import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import type { Timestamp } from "firebase-admin/firestore";
import type { MosqueImage } from "@/types/mosque";
import type {
  MosqueNewsPost,
  MosqueNewsStatus,
  MosqueNewsReactionCounts,
  MosqueNewsMyReactions,
} from "@/types/mosque-news";

export const NEWS_SUBCOLLECTION = "news";

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "toDate" in v && typeof (v as Timestamp).toDate === "function") {
    return (v as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

export function normalizeNewsPost(
  slug: string,
  id: string,
  raw: Record<string, unknown>,
): MosqueNewsPost | null {
  if (!raw || typeof raw !== "object") return null;
  const body = typeof raw.body === "string" ? raw.body : "";
  if (!body) return null;
  const likeCount = typeof raw.likeCount === "number" ? raw.likeCount : 0;
  const rc = raw.reactionCounts as Partial<MosqueNewsReactionCounts> | undefined;
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  // Legacy posts carried only `likeCount`; fold it into `heart` until they're
  // re-saved with a `reactionCounts` map.
  const reactionCounts: MosqueNewsReactionCounts = rc
    ? { amen: num(rc.amen), dua: num(rc.dua), heart: num(rc.heart) }
    : { amen: 0, dua: 0, heart: likeCount };
  return {
    id,
    mosqueSlug: (raw.mosqueSlug as string) ?? slug,
    body,
    image: raw.image as MosqueImage | undefined,
    authorUid: (raw.authorUid as string) ?? "",
    status: (raw.status as MosqueNewsStatus) ?? "visible",
    likeCount,
    reactionCounts,
    commentCount: typeof raw.commentCount === "number" ? raw.commentCount : 0,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
  };
}

export async function listMosqueNews(
  slug: string,
  opts: { limit?: number } = {},
): Promise<MosqueNewsPost[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection(MOSQUES_COLLECTION)
      .doc(slug)
      .collection(NEWS_SUBCOLLECTION)
      .where("status", "==", "visible")
      .orderBy("createdAt", "desc")
      .limit(opts.limit ?? 20)
      .get();
    return snap.docs
      .map((d) => normalizeNewsPost(slug, d.id, d.data() as Record<string, unknown>))
      .filter((p): p is MosqueNewsPost => p !== null);
  } catch (err) {
    console.warn("[mosques/news] list failed:", err);
    return [];
  }
}

/**
 * The given user's reactions (amen/du'a/heart booleans) for each post id, read
 * in one `getAll` batch. Returns an empty map for signed-out users.
 */
export async function getMyNewsReactions(
  slug: string,
  uid: string,
  postIds: string[],
): Promise<Map<string, MosqueNewsMyReactions>> {
  const out = new Map<string, MosqueNewsMyReactions>();
  if (!uid || postIds.length === 0) return out;
  const db = getDb();
  if (!db) return out;
  const col = db.collection(MOSQUES_COLLECTION).doc(slug).collection(NEWS_SUBCOLLECTION);
  try {
    const refs = postIds.map((id) => col.doc(id).collection("reactions").doc(uid));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, idx) => {
      const d = snap.data() ?? {};
      out.set(postIds[idx]!, { amen: !!d.amen, dua: !!d.dua, heart: !!d.heart });
    });
  } catch (err) {
    console.warn("[mosques/news] reactions read failed:", err);
  }
  return out;
}
