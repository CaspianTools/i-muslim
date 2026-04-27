// Registry of supported content (sacred-text translation) languages.
//
// Adding a language here is a code change — the value side stays static so
// types and lookups can stay simple. Once added, an admin can flip the
// language ON in /admin/settings; running the per-language seed scripts
// (`scripts/seed-quran-translation.ts`, `scripts/seed-hadith-translation.ts`)
// populates Firestore with the translated text for that language.
//
// LangCode is a plain `string` so render paths don't need to be re-typed when
// the registry grows. Bundled codes are the keys present in the maps below.

export type LangCode = string;

export const ALL_LANGS: readonly LangCode[] = [
  "ar",
  "en",
  "ru",
  "az",
  "tr",
] as const;

export const LANG_LABELS: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  ru: "Russian",
  az: "Azerbaijani",
  tr: "Turkish",
};

// Verified translation resource IDs on api.quran.com/api/v4/resources/translations.
// Arabic is the original — no translation ID. Add an entry when extending.
export const QURAN_TRANSLATION_IDS: Record<string, number> = {
  en: 20, // Saheeh International
  ru: 45, // Elmir Kuliev
  az: 75, // Alikhan Musayev
  tr: 77, // Diyanet İşleri Başkanlığı
};

export const QURAN_TRANSLATION_NAMES: Record<string, string> = {
  en: "Saheeh International",
  ru: "Эльмир Кулиев",
  az: "Əlixan Musayev",
  tr: "Diyanet İşleri Başkanlığı",
};

// fawazahmed0/hadith-api editions per language.
// Keys: language code → set of collection slugs that have a native edition.
// Collections not listed here fall back to English at render time.
//
// Edition slugs on the CDN follow the `${langCode3}-${collection}` pattern
// (see HADITH_EDITION_LANG below). Update both maps when adding a language.
export const HADITH_LANG_COVERAGE: Record<string, ReadonlySet<string>> = {
  en: new Set([
    "bukhari",
    "muslim",
    "abudawud",
    "tirmidhi",
    "nasai",
    "ibnmajah",
    "malik",
    "nawawi",
    "qudsi",
  ]),
  ru: new Set(["bukhari", "muslim", "abudawud"]),
  az: new Set(),
  // fawazahmed0 ships Turkish (`tur`) editions for these slugs as of writing;
  // the seed script will skip any that 404 and the renderer falls back to
  // English on a missing translation.
  tr: new Set(["bukhari"]),
};

// Maps our LangCode to fawazahmed0's 3-letter edition prefix. Used by both
// the runtime fetcher in lib/hadith.ts and the per-language seeder.
export const HADITH_EDITION_LANG: Record<string, string> = {
  ar: "ara",
  en: "eng",
  ru: "rus",
  tr: "tur",
};

const DEFAULT_LANGS: LangCode[] = ["ar", "en"];

export function parseLangsParam(raw: string | undefined | null): LangCode[] {
  if (!raw) return [...DEFAULT_LANGS];
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is LangCode => (ALL_LANGS as readonly string[]).includes(s));
  const uniq = Array.from(new Set<LangCode>(parts));
  // Preserve language order from ALL_LANGS so display stays consistent
  // regardless of input order. Allow Arabic to be deselected by the user.
  if (uniq.length === 0) return [...DEFAULT_LANGS];
  return ALL_LANGS.filter((l) => uniq.includes(l));
}

export function serializeLangs(langs: LangCode[]): string {
  return langs.join(",");
}

export function hadithLangsWithFallback(langs: LangCode[], collection: string) {
  // Returns ordered list of { requested, actual } per non-Arabic language,
  // applying English fallback when the requested translation is unavailable.
  const out: Array<{ requested: LangCode; actual: LangCode | null }> = [];
  for (const lang of langs) {
    if (lang === "ar") continue;
    const coverage = HADITH_LANG_COVERAGE[lang];
    if (coverage?.has(collection)) {
      out.push({ requested: lang, actual: lang });
    } else if (
      lang !== "en" &&
      HADITH_LANG_COVERAGE.en?.has(collection) &&
      !out.some((e) => e.actual === "en")
    ) {
      out.push({ requested: lang, actual: "en" });
    } else {
      out.push({ requested: lang, actual: null });
    }
  }
  return out;
}
