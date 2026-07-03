import "server-only";
import { unstable_cache } from "next/cache";
import { getDb } from "@/lib/firebase/admin";
import type { FavoriteItemType } from "@/types/profile";

export const FAVORITE_STATS_COLLECTION = "favoriteStats";
const FAVORITE_STATS_TAG = "favorite-stats";

export function favoriteStatsKey(itemType: FavoriteItemType, itemId: string): string {
  return `${itemType}__${itemId}`;
}

export async function getFavoriteStats(
  itemType: FavoriteItemType,
  itemId: string,
): Promise<{ count: number }> {
  const db = getDb();
  if (!db) return { count: 0 };
  try {
    const snap = await db
      .collection(FAVORITE_STATS_COLLECTION)
      .doc(favoriteStatsKey(itemType, itemId))
      .get();
    if (!snap.exists) return { count: 0 };
    const data = snap.data() ?? {};
    return { count: typeof data.count === "number" && data.count > 0 ? data.count : 0 };
  } catch (err) {
    console.warn("[profile/favoriteStats] getFavoriteStats failed:", err);
    return { count: 0 };
  }
}

// Aggregate favorite counts are non-critical display badges that change on every
// favorite toggle site-wide. A list page (e.g. a 286-ayah surah) previously did
// one stat read per item on every render. Cache the batched read briefly, keyed
// by itemType + ids (which are stable per surah/book), so repeat renders serve
// from the Data Cache. A short TTL keeps the badge within a few minutes of live
// without wiring invalidation into the very hot favorite-toggle path.
// `unstable_cache` can't serialize a Map, so the cached layer returns entries
// and the public wrapper rebuilds the Map.
const _getFavoriteCountEntries = unstable_cache(
  async (
    itemType: FavoriteItemType,
    itemIds: string[],
  ): Promise<Array<[string, number]>> => {
    if (itemIds.length === 0) return [];
    const db = getDb();
    if (!db) return [];

    const refs = itemIds.map((id) =>
      db.collection(FAVORITE_STATS_COLLECTION).doc(favoriteStatsKey(itemType, id)),
    );

    try {
      const snaps = await db.getAll(...refs);
      const entries: Array<[string, number]> = [];
      for (let i = 0; i < snaps.length; i++) {
        const snap = snaps[i]!;
        if (!snap.exists) continue;
        const data = snap.data() ?? {};
        const count = typeof data.count === "number" ? data.count : 0;
        if (count > 0) entries.push([itemIds[i]!, count]);
      }
      return entries;
    } catch (err) {
      console.warn("[profile/favoriteStats] getFavoriteCountsForEntities failed:", err);
      return [];
    }
  },
  ["favorite-stats:batch"],
  { revalidate: 300, tags: [FAVORITE_STATS_TAG] },
);

export async function getFavoriteCountsForEntities(
  itemType: FavoriteItemType,
  itemIds: string[],
): Promise<Map<string, number>> {
  return new Map(await _getFavoriteCountEntries(itemType, itemIds));
}

export async function getFavoriteCountsForAyahs(
  verseKeys: string[],
): Promise<Map<string, number>> {
  return getFavoriteCountsForEntities("ayah", verseKeys);
}

export async function getFavoriteCountsForHadiths(
  hadithKeys: string[],
): Promise<Map<string, number>> {
  return getFavoriteCountsForEntities("hadith", hadithKeys);
}

export async function getFavoriteCountsForBooks(
  bookKeys: string[],
): Promise<Map<string, number>> {
  return getFavoriteCountsForEntities("hadithBook", bookKeys);
}

export async function getFavoriteCountsForCollections(
  slugs: string[],
): Promise<Map<string, number>> {
  return getFavoriteCountsForEntities("hadithCollection", slugs);
}
