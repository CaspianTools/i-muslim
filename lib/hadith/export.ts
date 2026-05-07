import type { LangCode } from "@/lib/translations";
import type { HadithCollectionDoc, HadithDoc } from "@/lib/hadith/db";

export type HadithExportScope =
  | { kind: "collection" }
  | { kind: "book"; book: number; bookName: string; count: number };

export type HadithExportLang = "all" | LangCode;

export type HadithExportMode = "public" | "admin";

export type HadithExportOptions = {
  /** "public" mirrors the site-published view; "admin" includes drafts + metadata. */
  mode?: HadithExportMode;
  /** "all" keeps every translation; otherwise restrict to a single lang code. */
  lang?: HadithExportLang;
};

function pickTranslations(
  h: HadithDoc,
  mode: HadithExportMode,
  lang: HadithExportLang,
): Record<string, string> {
  const out: Record<string, string> = {};
  const translations = h.translations ?? {};
  const published = h.publishedTranslations ?? {};
  for (const [code, text] of Object.entries(translations)) {
    if (typeof text !== "string" || text.length === 0) continue;
    if (lang !== "all" && lang !== code) continue;
    if (mode === "public" && published[code] !== true) continue;
    out[code] = text;
  }
  return out;
}

export function buildHadithExport(
  meta: HadithCollectionDoc,
  hadiths: HadithDoc[],
  scope: HadithExportScope,
  options: HadithExportOptions = {},
) {
  const mode: HadithExportMode = options.mode ?? "public";
  const lang: HadithExportLang = options.lang ?? "all";

  const collectionInfo = {
    slug: meta.slug,
    name_en: meta.name_en,
    name_ar: meta.name_ar,
    short_name: meta.short_name,
    total: meta.total,
  };

  return {
    schema: "i-muslim/hadith/v1",
    exported_at: new Date().toISOString(),
    source: { name: "i-muslim", url: "https://i-muslim.app" },
    scope: scope.kind,
    mode,
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
    hadith: hadiths.map((h) => {
      const base = {
        number: h.number,
        arabic_number: h.arabic_number ?? h.number,
        book: h.book,
        hadith_in_book: h.hadith_in_book ?? h.number,
        text_ar: h.text_ar,
        translations: pickTranslations(h, mode, lang),
        narrator: h.narrator,
        grades:
          h.grades ?? (h.grade ? [{ name: "Grade", grade: h.grade }] : []),
        tags: h.tags,
      };
      if (mode === "admin") {
        return {
          ...base,
          published: h.published,
          publishedTranslations: h.publishedTranslations ?? {},
          notes: h.notes,
        };
      }
      return base;
    }),
  };
}
