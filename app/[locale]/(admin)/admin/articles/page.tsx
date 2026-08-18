import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { ArticlesPageClient } from "@/components/admin/articles/ArticlesPageClient";
import { fetchArticles } from "@/lib/admin/data/articles";
import { fetchArticleCategories } from "@/lib/admin/data/article-categories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("articlesAdmin.pages");
  return { title: t("listTitle") };
}

export default async function ArticlesAdminPage() {
  const [{ items, source }, { categories }] = await Promise.all([
    fetchArticles(),
    fetchArticleCategories(),
  ]);
  const t = await getTranslations("articlesAdmin.pages");
  return (
    <div>
      <PageHeader title={t("listTitle")} />
      <ArticlesPageClient
        initialItems={items}
        source={source}
        categories={categories}
      />
    </div>
  );
}
