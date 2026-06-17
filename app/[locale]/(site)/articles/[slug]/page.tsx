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
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { CommentThread } from "@/components/comments/CommentThread";
import { getSiteSession } from "@/lib/auth/session";
import { isFavorited } from "@/lib/profile/data";
import { getSiteConfig } from "@/lib/admin/data/site-config";
import { buildPageMetadata } from "@/lib/seo/metadata";

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
  const siteConfig = await getSiteConfig();
  const heroImageUrl = article.heroImageUrl ?? siteConfig.articlePlaceholderUrl;
  return buildPageMetadata({
    locale,
    path: `/articles/${slug}`,
    title: article.title,
    description: article.excerpt,
    type: "article",
    images: heroImageUrl ? [{ url: heroImageUrl }] : undefined,
    openGraph: {
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: ["I-Muslim Editorial"],
    },
  });
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
  const session = await getSiteSession();
  const [related, initialFavorited, siteConfig] = await Promise.all([
    getRelatedArticles(article.id, article.category, locale, 3),
    session ? isFavorited(session.uid, "article", article.id) : Promise.resolve(false),
    getSiteConfig(),
  ]);
  const heroImageUrl = article.heroImageUrl ?? siteConfig.articlePlaceholderUrl;

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

      {heroImageUrl && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg bg-muted">
          <Image
            src={heroImageUrl}
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

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <FavoriteButton
          itemType="article"
          itemId={article.id}
          itemMeta={{
            title: article.title,
            subtitle: article.excerpt,
            href: `/articles/${article.slug}`,
            thumbnail: article.heroImageUrl ?? null,
            locale,
          }}
          initialFavorited={initialFavorited}
          signedIn={Boolean(session)}
          size="md"
        />
        <ShareCopyButton url={url} />
      </div>

      <Disclaimer />

      <RelatedArticles articles={related} />

      <CommentThread
        entityType="article"
        entityId={article.id}
        itemMeta={{
          title: article.title,
          subtitle: article.excerpt,
          href: `/articles/${article.slug}`,
          locale,
        }}
      />
    </article>
  );
}
