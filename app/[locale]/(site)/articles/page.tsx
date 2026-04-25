import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { listPublishedArticles } from "@/lib/blog/data";
import { isCategorySlug } from "@/lib/blog/taxonomy";
import { ArticleList } from "@/components/articles/ArticleList";
import { LocaleNotAvailable } from "@/components/articles/LocaleNotAvailable";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("articles");
  return {
    title: t("pageTitle"),
    description: t("subtitle"),
  };
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("articles");
  const category = isCategorySlug(sp.category) ? sp.category : undefined;
  const { items } = await listPublishedArticles(locale, { category });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      </header>

      {items.length === 0 ? (
        locale === "en" ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <LocaleNotAvailable />
        )
      ) : (
        <ArticleList articles={items} />
      )}
    </div>
  );
}
