export type ReadItemType = "hadith" | "surah";

export interface HadithReadMark {
  itemType: "hadith";
  collection: string;
  book: number;
  number: number;
}

export interface SurahReadMark {
  itemType: "surah";
  surahId: number;
}

export type ReadMark = HadithReadMark | SurahReadMark;

export interface HadithCollectionReadSummary {
  total: number;
  byBook: Record<string, number>;
  latest?: { book: number; number: number; at: string };
}

export interface ReadsSummary {
  quran: {
    surahsRead: number;
    latest?: { surahId: number; at: string };
  };
  hadith: {
    total: number;
    byCollection: Record<string, HadithCollectionReadSummary>;
    latest?: { collection: string; book: number; number: number; at: string };
  };
  updatedAt: string;
}

export function emptyReadsSummary(): ReadsSummary {
  return {
    quran: { surahsRead: 0 },
    hadith: { total: 0, byCollection: {} },
    updatedAt: new Date(0).toISOString(),
  };
}

export interface SerializedReadMark {
  readId: string;
  mark: ReadMark;
  readAt: string;
}
