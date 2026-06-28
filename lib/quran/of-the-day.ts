import "server-only";
import { unstable_cache } from "next/cache";
import { getSurahs, getAyahsForSurah } from "@/lib/quran/db";
import { QURAN_TRANSLATION_IDS } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import { pickIndexByDate } from "@/lib/daily/date-seed";
import { cleanQuranTranslation } from "@/lib/text/html";
import type { Verse } from "@/types/quran";

export interface AyahOfTheDay {
  surah: number;
  ayah: number;
  surahName: string;
  surahNameArabic: string;
  arabic: string;
  translation: string | null;
  translationLang: LangCode | null;
}

function dateKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pickTranslation(
  verse: Verse,
  locale: LangCode,
): { text: string; lang: LangCode } | null {
  const wantedId = QURAN_TRANSLATION_IDS[locale];
  if (wantedId) {
    const hit = verse.translations.find((t) => t.resource_id === wantedId);
    if (hit?.text) return { text: hit.text, lang: locale };
  }
  if (locale !== "en") {
    const enId = QURAN_TRANSLATION_IDS.en;
    const hit = verse.translations.find((t) => t.resource_id === enId);
    if (hit?.text) return { text: hit.text, lang: "en" };
  }
  return null;
}

const _resolveAyahForDate = unstable_cache(
  async (dayKey: string): Promise<{ surah: number; ayah: number } | null> => {
    void dayKey;
    const surahs = await getSurahs();
    if (surahs.length === 0) return null;
    const total = surahs.reduce((sum, s) => sum + s.verses_count, 0);
    if (total <= 0) return null;
    const target = pickIndexByDate(total, new Date(dayKey));
    let cursor = 0;
    for (const s of surahs) {
      if (target < cursor + s.verses_count) {
        return { surah: s.id, ayah: target - cursor + 1 };
      }
      cursor += s.verses_count;
    }
    return null;
  },
  ["quran:of-the-day:resolve"],
  { revalidate: 60 * 60 * 24 },
);

export async function getAyahOfTheDay(
  date: Date,
  locale: LangCode,
): Promise<AyahOfTheDay | null> {
  const dayKey = dateKeyUTC(date);
  const target = await _resolveAyahForDate(dayKey);
  if (!target) return null;
  const [verses, surahs] = await Promise.all([
    getAyahsForSurah(target.surah),
    getSurahs(),
  ]);
  const verse = verses.find((v) => v.verse_number === target.ayah);
  const surahMeta = surahs.find((s) => s.id === target.surah);
  if (!verse || !surahMeta) return null;
  const translation = pickTranslation(verse, locale);
  return {
    surah: target.surah,
    ayah: target.ayah,
    surahName: surahMeta.name_simple,
    surahNameArabic: surahMeta.name_arabic,
    arabic: verse.text_uthmani,
    translation: translation
      ? cleanQuranTranslation(translation.text, translation.lang)
      : null,
    translationLang: translation?.lang ?? null,
  };
}
