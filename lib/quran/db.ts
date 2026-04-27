import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb } from "@/lib/firebase/admin";
import {
  QURAN_TRANSLATION_IDS,
  QURAN_TRANSLATION_NAMES,
} from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import type { Chapter, Verse, VerseTranslation } from "@/types/quran";

const SURAHS_TAG = "quran:surahs";
const surahTag = (n: number) => `quran:surah:${n}`;

const REVALIDATE_SECONDS = 60 * 60 * 24; // 1 day

type SurahDoc = {
  number: number;
  name_ar: string;
  name_en: string;
  name_complex?: string;
  name_translated?: string;
  revelation_place: "makkah" | "madinah";
  ayah_count: number;
  bismillah_pre: boolean;
};

type AyahDoc = {
  surah: number;
  ayah: number;
  text_ar: string;
  text_translit: string | null;
  // Open map keyed by LangCode (e.g. "en", "ru", "tr"). New translations are
  // added by per-language seed scripts; absent keys mean "not yet seeded for
  // this language" and the renderer skips that section for that ayah.
  translations: Record<string, string | undefined>;
  juz?: number;
  page?: number;
  sajdah?: boolean;
  published?: boolean;
};

function surahDocToChapter(d: SurahDoc): Chapter {
  return {
    id: d.number,
    revelation_place: d.revelation_place,
    revelation_order: 0,
    bismillah_pre: d.bismillah_pre,
    name_simple: d.name_en,
    name_complex: d.name_complex ?? d.name_en,
    name_arabic: d.name_ar,
    verses_count: d.ayah_count,
    pages: [0, 0],
    translated_name: {
      language_name: "english",
      name: d.name_translated ?? d.name_en,
    },
  };
}

function ayahDocToVerse(d: AyahDoc): Verse {
  const translations: VerseTranslation[] = [];
  for (const [code, text] of Object.entries(d.translations ?? {})) {
    if (!text) continue;
    const id = QURAN_TRANSLATION_IDS[code];
    if (id == null) continue; // translation key without a known resource ID
    translations.push({ id, resource_id: id, text });
  }
  return {
    id: d.surah * 10000 + d.ayah,
    verse_number: d.ayah,
    verse_key: `${d.surah}:${d.ayah}`,
    text_uthmani: d.text_ar,
    translations,
  };
}

const _getSurahs = unstable_cache(
  async (): Promise<Chapter[]> => {
    const db = getDb();
    if (!db) {
      console.error("[quran] Firestore not configured — returning empty surah list");
      return [];
    }
    const snap = await db.collection("quran_surahs").get();
    if (snap.empty) {
      console.error("[quran] quran_surahs collection is empty — run `npm run seed:quran`");
      return [];
    }
    return snap.docs
      .map((doc) => surahDocToChapter(doc.data() as SurahDoc))
      .sort((a, b) => a.id - b.id);
  },
  ["quran:surahs"],
  { revalidate: REVALIDATE_SECONDS, tags: [SURAHS_TAG] },
);

export async function getSurahs(): Promise<Chapter[]> {
  return _getSurahs();
}

export async function getSurah(id: number): Promise<Chapter | null> {
  const all = await getSurahs();
  return all.find((c) => c.id === id) ?? null;
}

const _getAyahsForSurah = unstable_cache(
  async (surah: number): Promise<Verse[]> => {
    const db = getDb();
    if (!db) {
      console.error(`[quran] Firestore not configured — returning empty ayah list for surah ${surah}`);
      return [];
    }
    const snap = await db
      .collection("quran_ayahs")
      .where("surah", "==", surah)
      .where("published", "==", true)
      .get();
    if (snap.empty) return [];
    return snap.docs
      .map((d) => ayahDocToVerse(d.data() as AyahDoc))
      .sort((a, b) => a.verse_number - b.verse_number);
  },
  ["quran:ayahs"],
  { revalidate: REVALIDATE_SECONDS },
);

export async function getAyahsForSurah(surah: number): Promise<Verse[]> {
  // Tag is per-surah so unstable_cache key + tag wrap together
  return unstable_cache(
    () => _getAyahsForSurah(surah),
    [`quran:ayahs:${surah}`],
    { revalidate: REVALIDATE_SECONDS, tags: [surahTag(surah)] },
  )();
}

/**
 * Filter a verse's translations to only the languages the caller wants.
 * Mirrors the existing API client behavior so AyahCard doesn't need to change.
 */
export function filterVerseLangs(verse: Verse, langs: LangCode[]): Verse {
  const wantedIds = new Set<number>();
  for (const lang of langs) {
    if (lang === "ar") continue;
    const id = QURAN_TRANSLATION_IDS[lang];
    if (id) wantedIds.add(id);
  }
  return {
    ...verse,
    translations: verse.translations.filter((t) => wantedIds.has(t.resource_id)),
  };
}

export function revalidateSurah(surah: number): void {
  // expire: 0 → immediate invalidation, since admin edits should appear on
  // the next public read without stale-while-revalidate.
  revalidateTag(surahTag(surah), { expire: 0 });
  revalidateTag(SURAHS_TAG, { expire: 0 });
}

// Used in admin-only contexts so we can show edit-time data without cache.
export { QURAN_TRANSLATION_NAMES };
