import "server-only";
import { unstable_cache } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import {
  COMMENTS_PAGE_SIZE,
  commentStatsKey,
  emptyReactionCounts,
  isCommentEntityType,
  isCommentStatus,
  type CommentAuthor,
  type CommentEntityType,
  type CommentItemMeta,
  type CommentReactionCounts,
  type CommentRecord,
  type CommentStatus,
} from "@/types/comments";

/**
 * Required Firestore composite indexes for the queries below — if any of
 * these is missing, Firestore will throw with a console URL to create it:
 *
 *   comments: entityType ASC, entityId ASC, parentId ASC, status ASC, createdAt DESC
 *   comments: entityType ASC, entityId ASC, status ASC, createdAt DESC
 *   comments: status ASC, updatedAt DESC
 *   comments: author.uid ASC, createdAt DESC
 */

export const COMMENTS_COLLECTION = "comments";
export const COMMENT_STATS_COLLECTION = "commentStats";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function tsToIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function normalizeAuthor(raw: unknown): CommentAuthor {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    uid: typeof r.uid === "string" ? r.uid : "",
    name: typeof r.name === "string" ? r.name : null,
    picture: typeof r.picture === "string" ? r.picture : null,
  };
}

function normalizeReactions(raw: unknown): CommentReactionCounts {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    heart: typeof r.heart === "number" ? r.heart : 0,
    dua: typeof r.dua === "number" ? r.dua : 0,
    insightful: typeof r.insightful === "number" ? r.insightful : 0,
  };
}

function normalizeMeta(raw: unknown): CommentItemMeta {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    title: typeof r.title === "string" ? r.title : "",
    subtitle: typeof r.subtitle === "string" ? r.subtitle : null,
    href: typeof r.href === "string" ? r.href : "/",
    locale: typeof r.locale === "string" ? r.locale : null,
  };
}

export function normalizeComment(
  id: string,
  raw: Record<string, unknown>,
): CommentRecord | null {
  if (!isCommentEntityType(raw.entityType)) return null;
  const entityId = raw.entityId;
  if (typeof entityId !== "string" || !entityId) return null;
  const status = isCommentStatus(raw.status) ? raw.status : "visible";
  const parentIdRaw = raw.parentId;
  const parentId =
    typeof parentIdRaw === "string" && parentIdRaw.length > 0 ? parentIdRaw : null;
  const rootId = typeof raw.rootId === "string" ? raw.rootId : id;
  return {
    id,
    entityType: raw.entityType,
    entityId,
    parentId,
    rootId,
    body: typeof raw.body === "string" ? raw.body : "",
    author: normalizeAuthor(raw.author),
    reactions: normalizeReactions(raw.reactions),
    replyCount: typeof raw.replyCount === "number" ? raw.replyCount : 0,
    flagCount: typeof raw.flagCount === "number" ? raw.flagCount : 0,
    status,
    itemMeta: normalizeMeta(raw.itemMeta),
    createdAt: tsToIso(raw.createdAt),
    updatedAt: tsToIso(raw.updatedAt ?? raw.createdAt),
    editedAt: tsToIsoOrNull(raw.editedAt),
  };
}

export interface ListCommentsOpts {
  entityType: CommentEntityType;
  entityId: string;
  parentId: string | null;
  page?: number;
  pageSize?: number;
  /** When true, includes auto_hidden so admin previews can show them. Public callers leave false. */
  includeAutoHidden?: boolean;
}

export interface ListCommentsResult {
  comments: CommentRecord[];
  hasMore: boolean;
  page: number;
  pageSize: number;
}

/**
 * Public list query: visible-only by default, oldest replies vs newest top-level
 * are both `createdAt DESC` to match the chosen sort order.
 */
export async function listComments(
  opts: ListCommentsOpts,
): Promise<ListCommentsResult> {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize ?? COMMENTS_PAGE_SIZE));
  const empty = { comments: [], hasMore: false, page, pageSize };
  if (!db) return empty;

  try {
    let q = db
      .collection(COMMENTS_COLLECTION)
      .where("entityType", "==", opts.entityType)
      .where("entityId", "==", opts.entityId)
      .where("parentId", "==", opts.parentId);

    const allowed: CommentStatus[] = opts.includeAutoHidden
      ? ["visible", "auto_hidden"]
      : ["visible"];
    q = q.where("status", "in", allowed);

    const offset = (page - 1) * pageSize;
    // Fetch one extra to detect hasMore without a count query.
    const snap = await q
      .orderBy("createdAt", "desc")
      .offset(offset)
      .limit(pageSize + 1)
      .get();

    const docs = snap.docs.slice(0, pageSize);
    const comments = docs
      .map((d) => normalizeComment(d.id, d.data() as Record<string, unknown>))
      .filter((c): c is CommentRecord => c !== null);
    return {
      comments,
      hasMore: snap.docs.length > pageSize,
      page,
      pageSize,
    };
  } catch (err) {
    console.warn("[comments/data] listComments failed:", err);
    return empty;
  }
}

export async function getCommentById(commentId: string): Promise<CommentRecord | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COMMENTS_COLLECTION).doc(commentId).get();
    if (!snap.exists) return null;
    return normalizeComment(snap.id, snap.data() as Record<string, unknown>);
  } catch (err) {
    console.warn("[comments/data] getCommentById failed:", err);
    return null;
  }
}

export async function getCommentStats(
  entityType: CommentEntityType,
  entityId: string,
): Promise<{ count: number; latestAt: string | null }> {
  const db = getDb();
  if (!db) return { count: 0, latestAt: null };
  try {
    const snap = await db
      .collection(COMMENT_STATS_COLLECTION)
      .doc(commentStatsKey(entityType, entityId))
      .get();
    if (!snap.exists) return { count: 0, latestAt: null };
    const data = snap.data() ?? {};
    return {
      count: typeof data.count === "number" ? data.count : 0,
      latestAt: tsToIsoOrNull(data.latestAt),
    };
  } catch (err) {
    console.warn("[comments/data] getCommentStats failed:", err);
    return { count: 0, latestAt: null };
  }
}

/**
 * Batched count read used by list-style readers (Quran surah, hadith book)
 * to seed the per-item comment icon badge. Mirrors the N+1-avoidance
 * pattern used by notes (see lib/profile/notes-data.ts:getNotesByItemType).
 */
// Cached like favorite counts (see lib/profile/favoriteStats.ts): the comment
// icon badge is a non-critical aggregate that previously cost one stat read per
// item per render on a long list page. Cache the batched read briefly, keyed by
// entityType + ids (stable per surah/book). `unstable_cache` can't serialize a
// Map, so cache entries and rebuild the Map in the wrapper.
const _getCommentCountEntries = unstable_cache(
  async (
    entityType: CommentEntityType,
    entityIds: string[],
  ): Promise<Array<[string, number]>> => {
    if (entityIds.length === 0) return [];
    const db = getDb();
    if (!db) return [];

    const refs = entityIds.map((id) =>
      db.collection(COMMENT_STATS_COLLECTION).doc(commentStatsKey(entityType, id)),
    );

    try {
      const snaps = await db.getAll(...refs);
      const entries: Array<[string, number]> = [];
      for (let i = 0; i < snaps.length; i++) {
        const snap = snaps[i]!;
        if (!snap.exists) continue;
        const data = snap.data() ?? {};
        const count = typeof data.count === "number" ? data.count : 0;
        if (count > 0) entries.push([entityIds[i]!, count]);
      }
      return entries;
    } catch (err) {
      console.warn("[comments/data] getCommentCountsForEntities failed:", err);
      return [];
    }
  },
  ["comment-stats:batch"],
  { revalidate: 300, tags: ["comment-stats"] },
);

export async function getCommentCountsForEntities(
  entityType: CommentEntityType,
  entityIds: string[],
): Promise<Map<string, number>> {
  return new Map(await _getCommentCountEntries(entityType, entityIds));
}

/** Convenience wrapper for the surah page. */
export async function getCommentCountsForAyahs(
  surahId: number,
  ayahNumbers: number[],
): Promise<Map<string, number>> {
  const verseKeys = ayahNumbers.map((n) => `${surahId}:${n}`);
  return getCommentCountsForEntities("ayah", verseKeys);
}

export { emptyReactionCounts };
