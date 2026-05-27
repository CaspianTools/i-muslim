import "server-only";
import { cache } from "react";
import { getDb } from "@/lib/firebase/admin";
import type { LangCode } from "@/lib/translations";

const STATS_COLLECTION = "config";
const STATS_DOC = "translationStats";

export type LangCountMap = Partial<Record<LangCode, number>>;

export type HadithCollectionStats = {
  slug: string;
  total: number;
  translated: number;
};

export type ContentTranslationStats = {
  quran: { total: number; perLang: LangCountMap };
  hadith: {
    total: number;
    perLang: LangCountMap;
    /**
     * Count of admin-authored translations per language across all hadith
     * collections (editedTranslations[lang] === true). These are the
     * translations released under i-muslim's own CC0 licence; the remainder
     * are upstream-mirrored and metadata-only via the public API.
     */
    authoredPerLang: LangCountMap;
    perCollection: Record<
      string,
      {
        total: number;
        perLang: LangCountMap;
        authoredPerLang: LangCountMap;
      }
    >;
  };
};

const EMPTY: ContentTranslationStats = {
  quran: { total: 0, perLang: {} },
  hadith: { total: 0, perLang: {}, authoredPerLang: {}, perCollection: {} },
};

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function asLangCountMap(raw: unknown): LangCountMap {
  if (!raw || typeof raw !== "object") return {};
  const out: LangCountMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = asNumber(v);
    if (n > 0) out[k as LangCode] = n;
  }
  return out;
}

function asPerCollection(
  raw: unknown,
): Record<
  string,
  { total: number; perLang: LangCountMap; authoredPerLang: LangCountMap }
> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<
    string,
    { total: number; perLang: LangCountMap; authoredPerLang: LangCountMap }
  > = {};
  for (const [slug, data] of Object.entries(raw as Record<string, unknown>)) {
    if (!data || typeof data !== "object") continue;
    const d = data as Record<string, unknown>;
    out[slug] = {
      total: asNumber(d.total),
      perLang: asLangCountMap(d.perLang),
      // `authoredPerLang` was added later — old stats docs lack it, so default
      // to an empty map. /downloads renders zero authored counts in that case.
      authoredPerLang: asLangCountMap(d.authoredPerLang),
    };
  }
  return out;
}

// Read pre-aggregated stats from `config/translationStats`. The doc is
// maintained by the seed scripts (and by `npm run recompute:translation-stats`
// for one-off rebuilds), so the page never has to run live count queries —
// no Firestore index dance, just one read.
export const getContentTranslationStats = cache(
  async (): Promise<ContentTranslationStats> => {
    const db = getDb();
    if (!db) return EMPTY;
    try {
      const snap = await db.collection(STATS_COLLECTION).doc(STATS_DOC).get();
      if (!snap.exists) return EMPTY;
      const data = (snap.data() ?? {}) as Record<string, unknown>;
      const quranRaw = (data.quran ?? {}) as Record<string, unknown>;
      const hadithRaw = (data.hadith ?? {}) as Record<string, unknown>;
      return {
        quran: {
          total: asNumber(quranRaw.total),
          perLang: asLangCountMap(quranRaw.perLang),
        },
        hadith: {
          total: asNumber(hadithRaw.total),
          perLang: asLangCountMap(hadithRaw.perLang),
          authoredPerLang: asLangCountMap(hadithRaw.authoredPerLang),
          perCollection: asPerCollection(hadithRaw.perCollection),
        },
      };
    } catch (err) {
      console.warn("[content-translation-stats] read failed:", err);
      return EMPTY;
    }
  },
);

// Convenience extractor used by the Settings dialog: returns one row per
// Hadith collection with the (total, translated) for the requested lang.
// Slug ordering follows the order the seed script emitted (alphabetical of
// the perCollection keys), with stable alphabetical sort as a fallback.
export function hadithPerCollectionForLang(
  stats: ContentTranslationStats,
  lang: LangCode,
): HadithCollectionStats[] {
  return Object.entries(stats.hadith.perCollection)
    .map(([slug, { total, perLang }]) => ({
      slug,
      total,
      translated: perLang[lang] ?? 0,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
