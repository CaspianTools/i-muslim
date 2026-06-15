export type CommentEntityType =
  | "ayah"
  | "hadith"
  | "surah"
  | "article"
  | "mosque"
  | "mosque_news"
  | "event"
  | "business";

export type CommentStatus = "visible" | "auto_hidden" | "hidden" | "deleted";

export type CommentReactionKind = "heart" | "dua" | "insightful";

export const COMMENT_ENTITY_TYPES: readonly CommentEntityType[] = [
  "ayah",
  "hadith",
  "surah",
  "article",
  "mosque",
  "mosque_news",
  "event",
  "business",
] as const;

export const COMMENT_STATUSES: readonly CommentStatus[] = [
  "visible",
  "auto_hidden",
  "hidden",
  "deleted",
] as const;

export const REACTION_KINDS: readonly CommentReactionKind[] = [
  "heart",
  "dua",
  "insightful",
] as const;

export const MAX_COMMENT_LENGTH = 5000;
export const FLAG_AUTO_HIDE_THRESHOLD = 3;
export const COMMENTS_PAGE_SIZE = 20;

export interface CommentItemMeta {
  title: string;
  subtitle?: string | null;
  href: string;
  locale?: string | null;
}

export interface CommentAuthor {
  uid: string;
  name: string | null;
  picture: string | null;
}

export interface CommentReactionCounts {
  heart: number;
  dua: number;
  insightful: number;
}

export interface CommentRecord {
  id: string;
  entityType: CommentEntityType;
  entityId: string;
  parentId: string | null;
  rootId: string;
  body: string;
  author: CommentAuthor;
  reactions: CommentReactionCounts;
  replyCount: number;
  flagCount: number;
  status: CommentStatus;
  itemMeta: CommentItemMeta;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
}

export function isCommentEntityType(v: unknown): v is CommentEntityType {
  return typeof v === "string" && (COMMENT_ENTITY_TYPES as readonly string[]).includes(v);
}

export function isCommentStatus(v: unknown): v is CommentStatus {
  return typeof v === "string" && (COMMENT_STATUSES as readonly string[]).includes(v);
}

export function isReactionKind(v: unknown): v is CommentReactionKind {
  return typeof v === "string" && (REACTION_KINDS as readonly string[]).includes(v);
}

/**
 * Composite Firestore stats key for a given entity. Used as the doc id
 * inside the `commentStats` collection, keeping the entityType in the key
 * so different entity types with overlapping ids never collide.
 */
export function commentStatsKey(entityType: CommentEntityType, entityId: string): string {
  return `${entityType}__${entityId}`;
}

export function emptyReactionCounts(): CommentReactionCounts {
  return { heart: 0, dua: 0, insightful: 0 };
}
