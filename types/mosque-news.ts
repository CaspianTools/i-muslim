import type { MosqueImage } from "@/types/mosque";

export type MosqueNewsStatus = "visible" | "taken_down";

/**
 * A masjid news post, stored in the `mosques/{slug}/news` subcollection.
 * Authored by the mosque manager and published instantly (decision #7);
 * admins can take a post down (`status: "taken_down"`). Body is single-language
 * as authored. Readers can like (one doc per uid under `.../likes/{uid}`) and
 * comment (reusing the shared `comments` collection with entityType
 * `"mosque_news"` and entityId `"<slug>:<postId>"`).
 */
export interface MosqueNewsPost {
  id: string;
  mosqueSlug: string;
  body: string;
  image?: MosqueImage;
  authorUid: string;
  status: MosqueNewsStatus;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export const MAX_NEWS_BODY_LENGTH = 2000;
