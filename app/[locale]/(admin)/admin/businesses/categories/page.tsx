import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { CategoriesClient } from "@/components/admin/businesses/CategoriesClient";
import { fetchCategories } from "@/lib/admin/data/business-taxonomies";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses.admin");
  return { title: t("categoriesPageTitle") };
}

export default async function AdminCategoriesPage() {
  const t = await getTranslations("businesses.admin");
  const { categories, source } = await fetchCategories();
  return (
    <div>
      <PageHeader title={t("categoriesPageTitle")} />
      <CategoriesClient initialCategories={categories} canPersist={source === "firestore"} />
    </div>
  );
}
