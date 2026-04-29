import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import {
  type FavoriteItemMeta,
  type FavoriteItemType,
  type FavoriteRecord,
  type ReadingProgressRecord,
  isFavoriteItemType,
} from "@/types/profile";
import type { ProfileFieldsRecord } from "@/lib/profile/schema";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function normalizeFavoriteMeta(raw: unknown): FavoriteItemMeta {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    title: typeof r.title === "string" ? r.title : "",
    subtitle: typeof r.subtitle === "string" ? r.subtitle : null,
    href: typeof r.href === "string" ? r.href : "/",
    thumbnail: typeof r.thumbnail === "string" ? r.thumbnail : null,
    arabic: typeof r.arabic === "string" ? r.arabic : null,
    locale: typeof r.locale === "string" ? r.locale : null,
  };
}

function normalizeFavorite(id: string, raw: Record<string, unknown>): FavoriteRecord | null {
  const itemType = raw.itemType;
  const itemId = raw.itemId;
  if (!isFavoriteItemType(itemType)) return null;
  if (typeof itemId !== "string" || !itemId) return null;
  return {
    id,
    itemType,
    itemId,
    itemMeta: normalizeFavoriteMeta(raw.itemMeta),
    createdAt: tsToIso(raw.createdAt),
  };
}

export async function listFavorites(
  uid: string,
  opts: { itemType?: FavoriteItemType; limit?: number } = {},
): Promise<FavoriteRecord[]> {
  const db = getDb();
  if (!db) return [];
  const col = db.collection("users").doc(uid).collection("favorites");
  const limit = opts.limit ?? 100;
  try {
    if (opts.itemType) {
      // Filter-only query (no orderBy) so we don't need a composite
      // (itemType, createdAt) index. Sort in memory — the per-user
      // favorites collection is small.
      const snap = await col.where("itemType", "==", opts.itemType).limit(limit).get();
      const records = snap.docs
        .map((d) => normalizeFavorite(d.id, d.data() as Record<string, unknown>))
        .filter((f): f is FavoriteRecord => f !== null);
      records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return records;
    }
    const snap = await col.orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs
      .map((d) => normalizeFavorite(d.id, d.data() as Record<string, unknown>))
      .filter((f): f is FavoriteRecord => f !== null);
  } catch (err) {
    console.warn("[profile/data] listFavorites failed:", err);
    return [];
  }
}

/**
 * Returns the set of itemIds the user has favorited for a given itemType.
 * Used by content list pages to seed initial favorited state without N+1 queries.
 */
export async function getFavoritedSet(
  uid: string,
  itemType: FavoriteItemType,
): Promise<Set<string>> {
  const db = getDb();
  if (!db) return new Set();
  try {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("favorites")
      .where("itemType", "==", itemType)
      .get();
    const set = new Set<string>();
    for (const doc of snap.docs) {
      const itemId = doc.get("itemId");
      if (typeof itemId === "string") set.add(itemId);
    }
    return set;
  } catch (err) {
    console.warn("[profile/data] getFavoritedSet failed:", err);
    return new Set();
  }
}

export async function isFavorited(
  uid: string,
  itemType: FavoriteItemType,
  itemId: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("favorites")
      .where("itemType", "==", itemType)
      .where("itemId", "==", itemId)
      .limit(1)
      .get();
    return !snap.empty;
  } catch (err) {
    console.warn("[profile/data] isFavorited failed:", err);
    return false;
  }
}

function normalizeReadingProgress(raw: Record<string, unknown> | undefined): ReadingProgressRecord {
  if (!raw) return {};
  const out: ReadingProgressRecord = {};

  const lq = raw.lastQuranAyah as Record<string, unknown> | undefined;
  if (lq && typeof lq.surah === "number" && typeof lq.ayah === "number") {
    out.lastQuranAyah = {
      surah: lq.surah,
      ayah: lq.ayah,
      verseKey: typeof lq.verseKey === "string" ? lq.verseKey : `${lq.surah}:${lq.ayah}`,
      viewedAt: tsToIso(lq.viewedAt),
    };
  }

  const ls = raw.lastSurah as Record<string, unknown> | undefined;
  if (ls && typeof ls.surah === "number") {
    out.lastSurah = { surah: ls.surah, viewedAt: tsToIso(ls.viewedAt) };
  }

  const lh = raw.lastHadith as Record<string, unknown> | undefined;
  if (
    lh &&
    typeof lh.collection === "string" &&
    typeof lh.book === "number" &&
    typeof lh.number === "number"
  ) {
    out.lastHadith = {
      collection: lh.collection,
      book: lh.book,
      number: lh.number,
      viewedAt: tsToIso(lh.viewedAt),
    };
  }

  const lhb = raw.lastHadithBook as Record<string, unknown> | undefined;
  if (lhb && typeof lhb.collection === "string" && typeof lhb.book === "number") {
    out.lastHadithBook = {
      collection: lhb.collection,
      book: lhb.book,
      viewedAt: tsToIso(lhb.viewedAt),
    };
  }

  return out;
}

function normalizeProfileFields(raw: Record<string, unknown> | undefined): ProfileFieldsRecord | null {
  if (!raw) return null;
  if (typeof raw.displayName !== "string" || !raw.displayName) return null;
  return {
    displayName: raw.displayName,
    gender: (raw.gender as ProfileFieldsRecord["gender"]) ?? "male",
    dateOfBirth: typeof raw.dateOfBirth === "string" ? raw.dateOfBirth : "",
    country: typeof raw.country === "string" ? raw.country : "",
    city: typeof raw.city === "string" ? raw.city : "",
    ethnicity: typeof raw.ethnicity === "string" ? raw.ethnicity : null,
    languages: Array.isArray(raw.languages) ? (raw.languages as string[]) : [],
    madhhab: (raw.madhhab as ProfileFieldsRecord["madhhab"]) ?? "none",
    sect: (raw.sect as ProfileFieldsRecord["sect"]) ?? "sunni",
    prayerCommitment:
      (raw.prayerCommitment as ProfileFieldsRecord["prayerCommitment"]) ?? "sometimes",
    hijab: (raw.hijab as ProfileFieldsRecord["hijab"]) ?? "na",
    beard: (raw.beard as ProfileFieldsRecord["beard"]) ?? "na",
    revert: Boolean(raw.revert),
    education: (raw.education as ProfileFieldsRecord["education"]) ?? "other",
    profession: typeof raw.profession === "string" ? raw.profession : null,
    maritalHistory:
      (raw.maritalHistory as ProfileFieldsRecord["maritalHistory"]) ?? "never_married",
    hasChildren: Boolean(raw.hasChildren),
    wantsChildren: (raw.wantsChildren as ProfileFieldsRecord["wantsChildren"]) ?? "maybe",
    bio: typeof raw.bio === "string" ? raw.bio : "",
    updatedAt: tsToIso(raw.updatedAt),
  };
}

export async function getProfileFields(uid: string): Promise<ProfileFieldsRecord | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return null;
    const data = doc.data();
    const profile = data?.profile;
    if (!profile || typeof profile !== "object") return null;
    return normalizeProfileFields(profile as Record<string, unknown>);
  } catch (err) {
    console.warn("[profile/data] getProfileFields failed:", err);
    return null;
  }
}

export async function getMatrimonialEnabled(uid: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const snap = await db.collection("matrimonialProfiles").doc(uid).get();
    if (!snap.exists) return false;
    const status = snap.get("status");
    return status === "active" || status === "pending";
  } catch (err) {
    console.warn("[profile/data] getMatrimonialEnabled failed:", err);
    return false;
  }
}

export async function getReadingProgress(uid: string): Promise<ReadingProgressRecord> {
  const db = getDb();
  if (!db) return {};
  try {
    const doc = await db.collection("users").doc(uid).collection("state").doc("readingProgress").get();
    if (!doc.exists) return {};
    return normalizeReadingProgress(doc.data());
  } catch (err) {
    console.warn("[profile/data] getReadingProgress failed:", err);
    return {};
  }
}
