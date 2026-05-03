import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { BusinessSubmissionsClient } from "@/components/admin/businesses/BusinessSubmissionsClient";
import { fetchBusinessSubmissions } from "@/lib/admin/data/businesses";
import { fetchCategories } from "@/lib/admin/data/business-taxonomies";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses.admin.submissions");
  return { title: t("queueTitle") };
}

export default async function AdminBusinessSubmissionsPage() {
  const [t, { submissions, source }, { categories }] = await Promise.all([
    getTranslations("businesses.admin.submissions"),
    fetchBusinessSubmissions(),
    fetchCategories(),
  ]);
  return (
    <div>
      <PageHeader title={t("queueTitle")} subtitle={t("queueSubtitle")} />
      <BusinessSubmissionsClient
        initialSubmissions={submissions}
        categories={categories}
        canPersist={source === "firestore"}
      />
    </div>
  );
}
