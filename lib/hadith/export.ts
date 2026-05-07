import type { HadithCollectionDoc, HadithDoc } from "@/lib/hadith/db";

export type HadithExportScope =
  | { kind: "collection" }
  | { kind: "book"; book: number; bookName: string; count: number };

function pickPublishedTranslations(
  h: HadithDoc,
): Record<string, string> {
  const out: Record<string, string> = {};
  const translations = h.translations ?? {};
  const published = h.publishedTranslations ?? {};
  for (const [lang, text] of Object.entries(translations)) {
    if (typeof text === "string" && text.length > 0 && published[lang] === true) {
      out[lang] = text;
    }
  }
  return out;
}

export function buildHadithExport(
  meta: HadithCollectionDoc,
  hadiths: HadithDoc[],
  scope: HadithExportScope,
) {
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
      translations: pickPublishedTranslations(h),
      narrator: h.narrator,
      grades:
        h.grades ?? (h.grade ? [{ name: "Grade", grade: h.grade }] : []),
      tags: h.tags,
    })),
  };
}
