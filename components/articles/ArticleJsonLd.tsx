import type { PublicArticle } from "@/types/blog";
import { jsonLdHtml } from "@/lib/seo/jsonld";

export function ArticleJsonLd({
  article,
  url,
}: {
  article: PublicArticle;
  url: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    image: article.heroImageUrl ? [article.heroImageUrl] : undefined,
    author: {
      "@type": "Organization",
      name: "I-Muslim Editorial",
    },
    publisher: {
      "@type": "Organization",
      name: "i-muslim",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }}
    />
  );
}
