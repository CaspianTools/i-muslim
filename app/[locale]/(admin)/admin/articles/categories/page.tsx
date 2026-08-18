import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { CategoriesClient } from "@/components/admin/articles/CategoriesClient";
import { fetchArticleCategories } from "@/lib/admin/data/article-categories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("articlesAdmin.pages");
  return { title: t("categoriesTitle") };
}

export default async function AdminArticleCategoriesPage() {
  const { categories, source } = await fetchArticleCategories();
  const t = await getTranslations("articlesAdmin.pages");
  return (
    <div>
      <PageHeader
        title={t("categoriesTitle")}
        subtitle={t("categoriesSubtitle")}
      />
      <CategoriesClient initialCategories={categories} canPersist={source === "firestore"} />
    </div>
  );
}
