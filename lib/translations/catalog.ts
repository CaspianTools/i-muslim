/**
 * Translation provenance catalogue — single source of truth for the public
 * /api/v1/translations/* endpoints. Each entry describes one (resource, lang)
 * pair: where the text came from, who authored it, what license governs it,
 * and whether the API may redistribute the text itself or must withhold it.
 *
 * Why this lives at runtime: the public download endpoint reads each entry to
 * decide whether to include the `text` field in the response. Anything marked
 * `redistribute: "metadata-only"` returns the attribution stanza but nulls out
 * the text — the consumer is pointed to the upstream source instead. This is
 * the legal seatbelt for translations whose copyright we don't control (i.e.
 * almost all of them).
 *
 * Adding a translation = adding an entry here. If the license is uncertain,
 * default to `"metadata-only"` until you can prove otherwise.
 *
 * Audited 2026-05-24:
 *  - Quran Arabic mushaf (Uthmani) is classical text — public domain.
 *  - Hadith Arabic editions are centuries-old text — public domain. The
 *    editorial apparatus (grading, book ordering) from al-maktaba.org /
 *    fawazahmed0's aggregation is itself unlicensed/free, so the Arabic
 *    payload is safe to redistribute in full.
 *  - All modern translations (Saheeh International for Quran EN, Kuliev for
 *    RU, Musayev for AZ, Diyanet for TR; sunnah.com-derived translators for
 *    Hadith EN/RU/TR) are under translator-held copyright with no published
 *    open-data grant. Saheeh International's official site
 *    (saheehinternational.com) was even taken over by a gambling operator —
 *    no public-facing licensing terms exist. All modern translations default
 *    to "metadata-only" until a permission letter or open licence is on file.
 */

export type RedistributeMode = "full" | "metadata-only";

export type TranslationCatalogEntry = {
  /** Stable catalogue key, e.g. "quran.com:20" or "fawazahmed0:eng-bukhari". */
  sourceId: string;
  /** Human-readable translator / publisher name. */
  attribution: string;
  /** Short license label. Use SPDX where one applies. */
  license: string;
  /** URL to the license text or the publisher's terms page. */
  licenseUrl?: string;
  /** Upstream URL where the text can be verified / re-fetched. */
  sourceUrl?: string;
  /**
   * "full"          → text is returned verbatim in the API response.
   * "metadata-only" → text is omitted (`text: null`); the consumer must obtain
   *                   the text from `sourceUrl`. Use whenever the upstream
   *                   licence does not unambiguously permit redistribution.
   */
  redistribute: RedistributeMode;
  /**
   * Optional one-line note shown to API consumers when text is withheld
   * (e.g. "Translator's copyright restricts redistribution"). Omit for
   * `full` entries.
   */
  notice?: string;
};

/* -------------------------------------------------------------------------- */
/* Quran                                                                       */
/* -------------------------------------------------------------------------- */

/** Catalog key for the Arabic original (no quran.com resource id; it's the mushaf). */
const QURAN_AR_KEY = "quran.com:mushaf-uthmani";

export const QURAN_TRANSLATION_CATALOG: Record<string, TranslationCatalogEntry> = {
  ar: {
    sourceId: QURAN_AR_KEY,
    attribution: "Uthmani Mushaf (classical text)",
    license: "Public Domain",
    sourceUrl: "https://api.quran.com/api/v4/verses/by_chapter/1?fields=text_uthmani",
    redistribute: "full",
  },
  en: {
    sourceId: "quran.com:20",
    attribution: "Saheeh International",
    license: "Proprietary (translator-held copyright)",
    sourceUrl: "https://api.quran.com/api/v4/resources/translations/20",
    redistribute: "metadata-only",
    notice:
      "Translator's copyright restricts redistribution. Fetch text directly from quran.com (resource id 20).",
  },
  ru: {
    sourceId: "quran.com:45",
    attribution: "Elmir Kuliev (Эльмир Кулиев)",
    license: "Proprietary (translator-held copyright)",
    sourceUrl: "https://api.quran.com/api/v4/resources/translations/45",
    redistribute: "metadata-only",
    notice:
      "Translator's copyright restricts redistribution. Fetch text directly from quran.com (resource id 45).",
  },
  az: {
    sourceId: "quran.com:75",
    attribution: "Alikhan Musayev (Əlixan Musayev)",
    license: "Proprietary (translator-held copyright)",
    sourceUrl: "https://api.quran.com/api/v4/resources/translations/75",
    redistribute: "metadata-only",
    notice:
      "Translator's copyright restricts redistribution. Fetch text directly from quran.com (resource id 75).",
  },
  tr: {
    sourceId: "quran.com:77",
    attribution: "Diyanet İşleri Başkanlığı",
    license: "Crown / Government — no open-data grant on file",
    sourceUrl: "https://api.quran.com/api/v4/resources/translations/77",
    redistribute: "metadata-only",
    notice:
      "Diyanet has not issued a public open-data grant. Fetch text directly from quran.com (resource id 77).",
  },
};

/* -------------------------------------------------------------------------- */
/* Hadith                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Hadith catalogue is keyed by `${collection}:${lang}`. Arabic editions across
 * all collections are public-domain classical texts (aggregated by
 * fawazahmed0/hadith-api, which is itself released under the Unlicense). All
 * modern translations (en/ru/tr) sit under translator copyright and default to
 * metadata-only.
 */
export const HADITH_COLLECTION_SLUGS = [
  "bukhari",
  "muslim",
  "abudawud",
  "tirmidhi",
  "nasai",
  "ibnmajah",
  "malik",
  "nawawi",
  "qudsi",
] as const;

export type HadithCollectionSlug = (typeof HADITH_COLLECTION_SLUGS)[number];

const HADITH_LANG_DEFAULTS: Record<
  string,
  Pick<
    TranslationCatalogEntry,
    "attribution" | "license" | "licenseUrl" | "redistribute" | "notice"
  >
> = {
  ar: {
    attribution: "Classical Arabic edition (public domain)",
    license: "Public Domain",
    licenseUrl: "https://unlicense.org/",
    redistribute: "full",
  },
  en: {
    attribution:
      "Various translators (aggregated by fawazahmed0/hadith-api from sunnah.com)",
    license: "Proprietary (translator-held copyright)",
    licenseUrl:
      "https://github.com/fawazahmed0/hadith-api/blob/1/References.md",
    redistribute: "metadata-only",
    notice:
      "English hadith translations are under translator copyright. Fetch text directly from the upstream edition (see source_url).",
  },
  ru: {
    attribution:
      "Various translators (aggregated by fawazahmed0/hadith-api)",
    license: "Proprietary (translator-held copyright)",
    licenseUrl:
      "https://github.com/fawazahmed0/hadith-api/blob/1/References.md",
    redistribute: "metadata-only",
    notice:
      "Russian hadith translations are under translator copyright. Fetch text directly from the upstream edition (see source_url).",
  },
  tr: {
    attribution:
      "Various translators (aggregated by fawazahmed0/hadith-api)",
    license: "Proprietary (translator-held copyright)",
    licenseUrl:
      "https://github.com/fawazahmed0/hadith-api/blob/1/References.md",
    redistribute: "metadata-only",
    notice:
      "Turkish hadith translations are under translator copyright. Fetch text directly from the upstream edition (see source_url).",
  },
};

/** fawazahmed0 edition-prefix per LangCode (mirrors HADITH_EDITION_LANG). */
const HADITH_EDITION_PREFIX: Record<string, string> = {
  ar: "ara",
  en: "eng",
  ru: "rus",
  tr: "tur",
};

function hadithEntry(
  collection: HadithCollectionSlug,
  lang: string,
): TranslationCatalogEntry | null {
  const defaults = HADITH_LANG_DEFAULTS[lang];
  const prefix = HADITH_EDITION_PREFIX[lang];
  if (!defaults || !prefix) return null;
  const sourceId = `fawazahmed0:${prefix}-${collection}`;
  return {
    sourceId,
    ...defaults,
    sourceUrl: `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${prefix}-${collection}.min.json`,
  };
}

/** Build at module init so lookups are O(1) and the catalogue is enumerable. */
export const HADITH_TRANSLATION_CATALOG: Record<
  string,
  TranslationCatalogEntry
> = (() => {
  const out: Record<string, TranslationCatalogEntry> = {};
  for (const slug of HADITH_COLLECTION_SLUGS) {
    for (const lang of Object.keys(HADITH_LANG_DEFAULTS)) {
      const e = hadithEntry(slug, lang);
      if (e) out[`${slug}:${lang}`] = e;
    }
  }
  return out;
})();

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export function getQuranCatalogEntry(
  lang: string,
): TranslationCatalogEntry | null {
  return QURAN_TRANSLATION_CATALOG[lang] ?? null;
}

export function getHadithCatalogEntry(
  collection: string,
  lang: string,
): TranslationCatalogEntry | null {
  return HADITH_TRANSLATION_CATALOG[`${collection}:${lang}`] ?? null;
}

/** Strip the catalogue entry of fields that don't belong in stored metadata. */
export function toStoredMeta(entry: TranslationCatalogEntry) {
  return {
    sourceId: entry.sourceId,
    attribution: entry.attribution,
    license: entry.license,
    licenseUrl: entry.licenseUrl ?? null,
    sourceUrl: entry.sourceUrl ?? null,
    redistribute: entry.redistribute,
  };
}
