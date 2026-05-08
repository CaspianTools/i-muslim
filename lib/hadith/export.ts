import { ALL_LANGS, type LangCode } from "@/lib/translations";
import type { HadithCollectionDoc, HadithDoc } from "@/lib/hadith/db";

export type HadithExportScope =
  | { kind: "collection" }
  | { kind: "book"; book: number; bookName: string; count: number };

export type HadithExportLang = "all" | LangCode;

export type HadithExportOptions = {
  /** "all" emits every configured non-Arabic language; otherwise restrict to that one. */
  lang?: HadithExportLang;
};

const TRANSLATABLE_LANGS = ALL_LANGS.filter((l) => l !== "ar");

const LANG_NATIVE_NAMES: Record<string, string> = {
  en: "English",
  ru: "Russian (Русский)",
  az: "Azerbaijani (Azərbaycanca)",
  tr: "Turkish (Türkçe)",
  ar: "Arabic (العربية)",
};

function placeholderFor(code: string): string {
  const label = LANG_NATIVE_NAMES[code] ?? code;
  return `[TRANSLATE TO ${label}: replace this string with the translation]`;
}

function pickTranslations(
  h: HadithDoc,
  lang: HadithExportLang,
): Record<string, string> {
  const targets: string[] =
    lang === "all" ? [...TRANSLATABLE_LANGS] : [lang];

  const out: Record<string, string> = {};
  const translations = h.translations ?? {};
  for (const code of targets) {
    if (code === "ar") continue;
    const text = translations[code];
    out[code] =
      typeof text === "string" && text.length > 0
        ? text
        : placeholderFor(code);
  }
  return out;
}

function buildInstructions(lang: HadithExportLang): Record<string, unknown> {
  const targetNames =
    lang === "all"
      ? TRANSLATABLE_LANGS.map((c) => LANG_NATIVE_NAMES[c] ?? c)
      : [LANG_NATIVE_NAMES[lang] ?? lang];

  return {
    purpose:
      `Translate this hadith file into: ${targetNames.join(", ")}. ` +
      "Inside each hadith's `translations` object, replace any string that begins with " +
      "`[TRANSLATE TO …]` with your translation in that language. Save and return the file as JSON.",
    rules: [
      "DO NOT modify `text_ar` — this is the original Arabic and must remain unchanged.",
      "DO NOT modify `number`, `arabic_number`, `book`, `hadith_in_book`, `narrator`, " +
        "`grades`, `tags`, `published`, `publishedTranslations`, or `notes`. " +
        "These are reference fields, not translation targets.",
      "Only replace strings inside the `translations` object that begin with `[TRANSLATE TO …]`.",
      "Leave existing translations alone unless you have been explicitly asked to revise them.",
      "Keep the JSON structure and quotes intact — do not rename keys or remove entries.",
    ],
    languageCodes: LANG_NATIVE_NAMES,
    fields: {
      text_ar: "Original Arabic text. Read-only.",
      translations:
        "Object mapping language code → translation. The only field you should edit.",
      narrator: "Narrator's name. Reference only — do not translate.",
      grades: "Authenticity grades. Reference only — do not translate.",
      published: "Internal publish flag. Reference only.",
      publishedTranslations:
        "Per-language internal publish flags. Reference only.",
      notes: "Internal admin notes. Reference only — do not translate.",
    },
  };
}

export function buildHadithExport(
  meta: HadithCollectionDoc,
  hadiths: HadithDoc[],
  scope: HadithExportScope,
  options: HadithExportOptions = {},
) {
  const lang: HadithExportLang = options.lang ?? "all";

  const collectionInfo = {
    slug: meta.slug,
    name_en: meta.name_en,
    name_ar: meta.name_ar,
    short_name: meta.short_name,
    total: meta.total,
  };

  return {
    _instructions: buildInstructions(lang),
    schema: "i-muslim/hadith/v1",
    exported_at: new Date().toISOString(),
    source: { name: "i-muslim", url: "https://i-muslim.app" },
    scope: scope.kind,
    lang,
    collection: collectionInfo,
    ...(scope.kind === "collection"
      ? { books: meta.books }
      : {
          book: {
            number: scope.book,
            name: scope.bookName,
            count: scope.count,
          },
        }),
    hadith_count: hadiths.length,
    hadith: hadiths.map((h) => ({
      number: h.number,
      arabic_number: h.arabic_number ?? h.number,
      book: h.book,
      hadith_in_book: h.hadith_in_book ?? h.number,
      text_ar: h.text_ar,
      translations: pickTranslations(h, lang),
      narrator: h.narrator,
      grades:
        h.grades ?? (h.grade ? [{ name: "Grade", grade: h.grade }] : []),
      tags: h.tags,
      published: h.published,
      publishedTranslations: h.publishedTranslations ?? {},
      notes: h.notes,
    })),
  };
}
