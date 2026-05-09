import "server-only";
import { getDb } from "@/lib/firebase/admin";
import type { FavoriteItemType } from "@/types/profile";

export const FAVORITE_STATS_COLLECTION = "favoriteStats";

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

export async function getFavoriteCountsForEntities(
  itemType: FavoriteItemType,
  itemIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (itemIds.length === 0) return out;
  const db = getDb();
  if (!db) return out;

  const refs = itemIds.map((id) =>
    db.collection(FAVORITE_STATS_COLLECTION).doc(favoriteStatsKey(itemType, id)),
  );

  try {
    const snaps = await db.getAll(...refs);
    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i]!;
      if (!snap.exists) continue;
      const data = snap.data() ?? {};
      const count = typeof data.count === "number" ? data.count : 0;
      if (count > 0) out.set(itemIds[i]!, count);
    }
    return out;
  } catch (err) {
    console.warn("[profile/favoriteStats] getFavoriteCountsForEntities failed:", err);
    return out;
  }
}

export async function getFavoriteCountsForAyahs(
  verseKeys: string[],
): Promise<Map<string, number>> {
  return getFavoriteCountsForEntities("ayah", verseKeys);
}
