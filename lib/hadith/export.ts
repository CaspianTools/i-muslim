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

  const singleLang = lang !== "all";

  const rules: string[] = [
    "DO NOT modify `text_ar` — this is the original Arabic and must remain unchanged.",
    "DO NOT modify `number`, `arabic_number`, `book`, `hadith_in_book`, `narrator`, " +
      "`grades`, `tags`, `published`, or `notes`. " +
      "These are reference fields, not translation targets.",
    "Only replace strings inside the `translations` object that begin with `[TRANSLATE TO …]`.",
    "Leave existing translations alone unless you have been explicitly asked to revise them.",
    "Keep the JSON structure and quotes intact — do not rename keys or remove entries.",
  ];
  if (singleLang) {
    rules.push(
      "Set `status` to `published` only when the translation is final and reviewed; " +
        "otherwise leave it as `draft`. Do not set `status: published` for entries whose " +
        "`translations." +
        lang +
        "` still begins with `[TRANSLATE TO …]` — those will be rejected on upload.",
    );
  }

  const fields: Record<string, string> = {
    text_ar: "Original Arabic text. Read-only.",
    translations:
      "Object mapping language code → translation. The only field you should edit (besides `status`).",
    narrator: "Narrator's name. Reference only — do not translate.",
    grades: "Authenticity grades. Reference only — do not translate.",
    published: "Internal publish flag. Reference only.",
    notes: "Internal admin notes. Reference only — do not translate.",
  };
  if (singleLang) {
    fields.status =
      "Per-language publish state for `" +
      lang +
      "`: `draft` (default) or `published`. Editable.";
  } else {
    fields.publishedTranslations =
      "Per-language publish flags. Editable on re-upload.";
  }

  return {
    purpose:
      `Translate this hadith file into: ${targetNames.join(", ")}. ` +
      "Inside each hadith's `translations` object, replace any string that begins with " +
      "`[TRANSLATE TO …]` with your translation in that language." +
      (singleLang
        ? ` When a translation is final, change that hadith's \`status\` from \`draft\` to \`published\`.`
        : "") +
      " Save and return the file as JSON.",
    rules,
    languageCodes: LANG_NATIVE_NAMES,
    fields,
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
    schema: "i-muslim/hadith/v2",
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
      ...(lang === "all"
        ? { publishedTranslations: h.publishedTranslations ?? {} }
        : {
            status: (h.publishedTranslations?.[lang] === true
              ? "published"
              : "draft") as "draft" | "published",
          }),
      notes: h.notes,
    })),
  };
}
