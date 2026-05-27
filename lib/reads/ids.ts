import type { ReadMark } from "@/types/reads";

export function surahReadId(surahId: number): string {
  return `quran_surah_${surahId}`;
}

export function hadithReadId(mark: {
  collection: string;
  book: number;
  number: number;
}): string {
  return `hadith_${mark.collection}_${mark.book}_${mark.number}`;
}

export function readIdFromMark(mark: ReadMark): string {
  if (mark.itemType === "surah") return surahReadId(mark.surahId);
  return hadithReadId(mark);
}

const HADITH_RE = /^hadith_([a-z0-9-]+)_(\d+)_(\d+)$/i;
const SURAH_RE = /^quran_surah_(\d+)$/;

export function parseReadId(readId: string): ReadMark | null {
  const h = HADITH_RE.exec(readId);
  if (h) {
    return {
      itemType: "hadith",
      collection: h[1]!,
      book: Number(h[2]),
      number: Number(h[3]),
    };
  }
  const s = SURAH_RE.exec(readId);
  if (s) {
    return { itemType: "surah", surahId: Number(s[1]) };
  }
  return null;
}

export function hrefForMark(mark: ReadMark): string {
  if (mark.itemType === "surah") return `/quran/${mark.surahId}`;
  return `/hadith/${mark.collection}/${mark.number}`;
}
