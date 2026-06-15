import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import type { Timestamp } from "firebase-admin/firestore";
import type { MosqueImage } from "@/types/mosque";
import type { MosqueNewsPost, MosqueNewsStatus } from "@/types/mosque-news";

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
  return {
    id,
    mosqueSlug: (raw.mosqueSlug as string) ?? slug,
    body,
    image: raw.image as MosqueImage | undefined,
    authorUid: (raw.authorUid as string) ?? "",
    status: (raw.status as MosqueNewsStatus) ?? "visible",
    likeCount: typeof raw.likeCount === "number" ? raw.likeCount : 0,
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

/** Which of these post ids the given user has liked (per-post reads; small feeds). */
export async function getLikedPostIds(
  slug: string,
  uid: string,
  postIds: string[],
): Promise<Set<string>> {
  const db = getDb();
  if (!db || postIds.length === 0) return new Set();
  const liked = new Set<string>();
  const col = db.collection(MOSQUES_COLLECTION).doc(slug).collection(NEWS_SUBCOLLECTION);
  await Promise.all(
    postIds.map(async (postId) => {
      const d = await col.doc(postId).collection("likes").doc(uid).get();
      if (d.exists) liked.add(postId);
    }),
  );
  return liked;
}
