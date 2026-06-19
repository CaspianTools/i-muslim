import "server-only";
import { unstable_cache } from "next/cache";
import { getHadithCollection, getHadithsByBook, type HadithDoc } from "@/lib/hadith/db";
import type { LangCode } from "@/lib/translations";
import { pickIndexByDate } from "@/lib/daily/date-seed";

const POOL_COLLECTION = "nawawi";

export interface HadithOfTheDay {
  collection: string;
  collectionName: string;
  number: number;
  arabic: string;
  translation: string | null;
  translationLang: LangCode | null;
  narrator: string | null;
  grade: string | null;
}

function dateKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pickTranslation(
  doc: HadithDoc,
  locale: LangCode,
): { text: string; lang: LangCode } | null {
  const native = doc.translations[locale];
  // Show the UI-locale translation whenever it has been published — mirroring the
  // reader's resolveTranslation contract — instead of gating on the seed-time CDN
  // coverage table (which suppressed published Nawawi translations on the homepage
  // card even though the detail page rendered them). Falls back to English below.
  if (native && doc.publishedTranslations?.[locale] === true) {
    return { text: native, lang: locale };
  }
  if (locale !== "en") {
    const en = doc.translations.en;
    if (en && doc.publishedTranslations?.en !== false) {
      return { text: en, lang: "en" };
    }
  }
  return null;
}

const _resolveHadithForDate = unstable_cache(
  async (dayKey: string): Promise<HadithDoc | null> => {
    const meta = await getHadithCollection(POOL_COLLECTION);
    if (!meta) return null;
    const books = meta.books.length > 0 ? meta.books : [{ number: 1, name: "", count: meta.total }];
    const allHadiths: HadithDoc[] = [];
    for (const b of books) {
      const docs = await getHadithsByBook(POOL_COLLECTION, b.number);
      allHadiths.push(...docs);
    }
    if (allHadiths.length === 0) return null;
    const idx = pickIndexByDate(allHadiths.length, new Date(dayKey));
    return allHadiths[idx] ?? null;
  },
  ["hadith:of-the-day:resolve"],
  { revalidate: 60 * 60 * 24 },
);

export async function getHadithOfTheDay(
  date: Date,
  locale: LangCode,
): Promise<HadithOfTheDay | null> {
  const dayKey = dateKeyUTC(date);
  const doc = await _resolveHadithForDate(dayKey);
  if (!doc) return null;
  const meta = await getHadithCollection(doc.collection);
  const translation = pickTranslation(doc, locale);
  return {
    collection: doc.collection,
    collectionName: meta?.short_name ?? meta?.name_en ?? doc.collection,
    number: doc.number,
    arabic: doc.text_ar,
    translation: translation?.text ?? null,
    translationLang: translation?.lang ?? null,
    narrator: doc.narrator,
    grade: doc.grade,
  };
}
