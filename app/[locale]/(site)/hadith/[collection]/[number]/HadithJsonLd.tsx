type ArticleData = {
  canonicalUrl: string;
  locale: string;
  collectionSlug: string;
  collectionNameEn: string;
  collectionNameAr: string;
  collectionUrl: string;
  number: number;
  narrator: string | null;
  articleBody: string;
  articleBodyLanguage: string;
  textAr: string;
  dateModified?: string;
};

type BreadcrumbData = {
  homeUrl: string;
  homeLabel: string;
  hadithUrl: string;
  hadithLabel: string;
  collectionUrl: string;
  collectionName: string;
  bookUrl: string;
  bookLabel: string;
  hadithNumberLabel: string;
};

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out as T;
}

export function HadithJsonLd({
  article,
  breadcrumbs,
}: {
  article: ArticleData;
  breadcrumbs: BreadcrumbData;
}) {
  const articleData = stripUndefined({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${article.collectionNameEn} — Hadith ${article.number}`,
    inLanguage: article.locale,
    identifier: `${article.collectionSlug}:${article.number}`,
    articleBody: article.articleBody,
    dateModified: article.dateModified,
    author: article.narrator
      ? { "@type": "Person", name: article.narrator }
      : undefined,
    isPartOf: {
      "@type": "CreativeWorkSeries",
      name: article.collectionNameEn,
      alternateName: article.collectionNameAr,
      url: article.collectionUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": article.canonicalUrl,
    },
    translationOfWork: {
      "@type": "CreativeWork",
      inLanguage: "ar",
      text: article.textAr,
    },
  });

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: breadcrumbs.homeLabel, item: breadcrumbs.homeUrl },
      { "@type": "ListItem", position: 2, name: breadcrumbs.hadithLabel, item: breadcrumbs.hadithUrl },
      { "@type": "ListItem", position: 3, name: breadcrumbs.collectionName, item: breadcrumbs.collectionUrl },
      { "@type": "ListItem", position: 4, name: breadcrumbs.bookLabel, item: breadcrumbs.bookUrl },
      { "@type": "ListItem", position: 5, name: breadcrumbs.hadithNumberLabel },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
    </>
  );
}
