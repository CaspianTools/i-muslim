export type FavoriteItemType =
  | "ayah"
  | "surah"
  | "hadith"
  | "hadithBook"
  | "hadithCollection"
  | "article"
  | "event"
  | "matrimonialProfile";

export interface FavoriteItemMeta {
  title: string;
  subtitle?: string | null;
  href: string;
  thumbnail?: string | null;
  arabic?: string | null;
  locale?: string | null;
}

export interface FavoriteRecord {
  id: string;
  itemType: FavoriteItemType;
  itemId: string;
  itemMeta: FavoriteItemMeta;
  createdAt: string;
}

export interface ReadingProgressQuranAyah {
  surah: number;
  ayah: number;
  verseKey: string;
  viewedAt: string;
}

export interface ReadingProgressSurah {
  surah: number;
  viewedAt: string;
}

export interface ReadingProgressHadith {
  collection: string;
  book: number;
  number: number;
  viewedAt: string;
}

export interface ReadingProgressHadithBook {
  collection: string;
  book: number;
  viewedAt: string;
}

export interface ReadingProgressRecord {
  lastQuranAyah?: ReadingProgressQuranAyah;
  lastSurah?: ReadingProgressSurah;
  lastHadith?: ReadingProgressHadith;
  lastHadithBook?: ReadingProgressHadithBook;
}

export const FAVORITE_ITEM_TYPES: readonly FavoriteItemType[] = [
  "ayah",
  "surah",
  "hadith",
  "hadithBook",
  "hadithCollection",
  "article",
  "event",
  "matrimonialProfile",
] as const;

export function isFavoriteItemType(v: unknown): v is FavoriteItemType {
  return typeof v === "string" && (FAVORITE_ITEM_TYPES as readonly string[]).includes(v);
}
