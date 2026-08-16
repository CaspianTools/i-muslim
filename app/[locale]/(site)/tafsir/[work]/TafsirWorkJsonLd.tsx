import { jsonLdHtml } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/metadata";
import type { TafsirWork } from "@/lib/tafsir/works";

/** `Book` + `BreadcrumbList` for the work landing page. Mirrors HadithJsonLd. */
export function TafsirWorkJsonLd({
  work,
  locale,
}: {
  work: TafsirWork;
  locale: string;
}) {
  const url = `${SITE_URL}/${locale}/tafsir/${work.id}`;

  const book = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: work.name,
    alternateName: work.nameArabic,
    url,
    inLanguage: work.langs,
    author: {
      "@type": "Person",
      name: work.author,
      description: `d. ${work.authorDiedAH} AH`,
    },
    about: {
      "@type": "CreativeWork",
      name: "The Quran",
      alternateName: "القرآن الكريم",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_URL}/${locale}`,
      },
      { "@type": "ListItem", position: 2, name: work.name },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(book) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbs) }}
      />
    </>
  );
}
