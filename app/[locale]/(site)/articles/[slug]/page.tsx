import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import {
  getArticleBySlug,
  getRelatedArticles,
} from "@/lib/blog/data";
import { ArticleBody } from "@/components/articles/ArticleBody";
import { ArticleJsonLd } from "@/components/articles/ArticleJsonLd";
import { CategoryPill } from "@/components/articles/CategoryPill";
import { Disclaimer } from "@/components/articles/Disclaimer";
import { RelatedArticles } from "@/components/articles/RelatedArticles";
import { ShareCopyButton } from "@/components/articles/ShareCopyButton";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "http://localhost:7777";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const article = await getArticleBySlug(slug, locale);
  if (!article) return { title: "Not found" };
  const url = `${SITE_URL}/articles/${slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      url,
      images: article.heroImageUrl ? [{ url: article.heroImageUrl }] : undefined,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: ["I-Muslim Editorial"],
    },
    twitter: {
      card: article.heroImageUrl ? "summary_large_image" : "summary",
      title: article.title,
      description: article.excerpt,
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const article = await getArticleBySlug(slug, locale);
  if (!article) notFound();

  const t = await getTranslations("articles");
  const date = new Date(article.publishedAt);
  const url = `${SITE_URL}/articles/${slug}`;
  const related = await getRelatedArticles(
    article.id,
    article.category,
    locale,
    3,
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <ArticleJsonLd article={article} url={url} />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <CategoryPill category={article.category} />
        <time dateTime={article.publishedAt}>
          {t("publishedOn", { date: date.toLocaleDateString() })}
        </time>
        <span aria-hidden>·</span>
        <span>{t("readingMinutes", { count: article.readingMinutes })}</span>
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {article.title}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">{article.excerpt}</p>

      {article.heroImageUrl && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg bg-muted">
          <Image
            src={article.heroImageUrl}
            alt={article.heroImageAlt ?? ""}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            priority
            className="object-cover"
          />
        </div>
      )}

      <div className="mt-8">
        <ArticleBody html={article.bodyHtml} />
      </div>

      <div className="mt-8 flex items-center gap-2">
        <ShareCopyButton url={url} />
      </div>

      <Disclaimer />

      <RelatedArticles articles={related} />
    </article>
  );
}
