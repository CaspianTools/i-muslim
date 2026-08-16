import { jsonLdHtml } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/metadata";
import type { TafsirLang, TafsirWork } from "@/lib/tafsir/works";

/**
 * `Article` + `BreadcrumbList` for one tafsir passage, modelled on
 * HadithJsonLd.tsx.
 *
 * Two deliberate departures from that file:
 *   * `inLanguage` is the CONTENT language, not the UI locale — here the
 *     article body IS the tafsir, so claiming "en" for Arabic prose would be
 *     wrong.
 *   * `articleBody` is omitted in favour of `abstract`. A hadith is a few
 *     hundred bytes; a tafsir block runs to 120 KB, and restating it in JSON-LD
 *     would double the page weight to repeat text already in the HTML.
 */
export function TafsirBlockJsonLd({
  work,
  lang,
  locale,
  surahName,
  coverage,
  canonicalUrl,
  abstract,
  surah,
  ayahStart,
}: {
  work: TafsirWork;
  lang: TafsirLang;
  locale: string;
  surahName: string;
  coverage: string;
  canonicalUrl: string;
  abstract: string;
  surah: number;
  ayahStart: number;
}) {
  const url = `${SITE_URL}/${locale}${canonicalUrl}`;
  const workUrl = `${SITE_URL}/${locale}/tafsir/${work.id}`;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${work.name} — ${surahName} ${coverage}`,
    inLanguage: lang,
    identifier: `${work.id}:${lang}:${surah}:${coverage}`,
    abstract,
    author: {
      "@type": "Person",
      name: work.author,
      description: `d. ${work.authorDiedAH} AH`,
    },
    isPartOf: {
      "@type": "Book",
      name: work.name,
      alternateName: work.nameArabic,
      url: workUrl,
    },
    about: {
      "@type": "CreativeWork",
      name: `Quran ${surah}:${coverage}`,
      url: `${SITE_URL}/${locale}/quran/${surah}#${surah}:${ayahStart}`,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/${locale}` },
      { "@type": "ListItem", position: 2, name: work.name, item: workUrl },
      {
        "@type": "ListItem",
        position: 3,
        name: lang === "ar" ? "Arabic" : "Bahasa Indonesia",
        item: `${workUrl}/${lang}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: surahName,
        item: `${workUrl}/${lang}/${surah}`,
      },
      { "@type": "ListItem", position: 5, name: coverage },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(article) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbs) }}
      />
    </>
  );
}
