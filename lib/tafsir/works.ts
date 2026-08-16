// Registry of tafsir (Quran commentary) works and the languages each ships in.
//
// This is deliberately SEPARATE from `ALL_LANGS` in lib/translations.ts. That
// list drives the Quran *translation* picker in the reader, and the two sets
// don't match: we ship Indonesian tafsir but no Indonesian Quran translation
// (`QURAN_TRANSLATION_IDS` has no `id`), and we ship no tafsir at all in the
// en/ru/az/tr translations the reader offers. Folding `id` into ALL_LANGS to
// make tafsir work would advertise an Indonesian translation that renders
// nothing.
//
// Adding a work or a language here is a code change: the corpus has to be
// seeded (`npm run seed:tafsir -- --work=<id> --lang=<code>`), a committed
// ayah→block index has to exist at lib/tafsir/index/<lang>.json, and a
// licensing entry has to be added to lib/translations/catalog.ts.

export type TafsirLang = "ar" | "id";

export type TafsirWork = {
  /** URL slug and Firestore doc-id prefix. Stable — changing it breaks links. */
  id: string;
  /** English display name of the work. */
  name: string;
  /** Arabic title, shown alongside the English name. */
  nameArabic: string;
  /** Author, as displayed in attribution. */
  author: string;
  /** Death year of the author, in AH — used in attribution lines. */
  authorDiedAH: number;
  /** Languages this work is available in, in display order. */
  langs: readonly TafsirLang[];
};

export const TAFSIR_WORKS: readonly TafsirWork[] = [
  {
    id: "ibn-kathir",
    name: "Tafsir Ibn Kathir",
    nameArabic: "تفسير القرآن العظيم",
    author: "Ismail ibn Kathir",
    authorDiedAH: 774,
    langs: ["ar", "id"],
  },
] as const;

export const DEFAULT_TAFSIR_WORK = "ibn-kathir";

const BY_ID = new Map(TAFSIR_WORKS.map((w) => [w.id, w]));

export function getTafsirWork(id: string): TafsirWork | null {
  return BY_ID.get(id) ?? null;
}

export function isTafsirLang(value: string): value is TafsirLang {
  return value === "ar" || value === "id";
}

/** True when `work` publishes `lang`. Guards every route param pair. */
export function workHasLang(work: TafsirWork, lang: string): lang is TafsirLang {
  return isTafsirLang(lang) && (work.langs as readonly string[]).includes(lang);
}

/**
 * The tafsir language to show by default for a given UI locale. Indonesian
 * readers get the Indonesian translation; everyone else gets the Arabic
 * original, which is the only other language we publish. Callers should label
 * this honestly rather than implying the UI locale is available.
 */
export function defaultTafsirLang(locale: string, work: TafsirWork): TafsirLang {
  if (locale === "id" && workHasLang(work, "id")) return "id";
  return work.langs[0] ?? "ar";
}
