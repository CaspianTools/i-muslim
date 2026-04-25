import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { BusinessReportsClient } from "@/components/admin/businesses/BusinessReportsClient";
import { fetchBusinessReports } from "@/lib/admin/data/business-reports";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses.admin");
  return { title: t("reportsPageTitle") };
}

export default async function AdminBusinessReportsPage() {
  const t = await getTranslations("businesses.admin");
  const { reports, source } = await fetchBusinessReports();
  return (
    <div>
      <PageHeader title={t("reportsPageTitle")} subtitle={t("reportsPageSubtitle")} />
      <BusinessReportsClient initialReports={reports} canPersist={source === "firestore"} />
    </div>
  );
}
