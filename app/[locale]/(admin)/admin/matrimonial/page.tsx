import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { fetchAdminMatrimonial } from "@/lib/admin/data/matrimonial";
import { computeMatrimonialStats } from "@/lib/admin/data/matrimonial-stats";
import { MatrimonialPageClient } from "@/components/admin/matrimonial/MatrimonialPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matrimonial.admin");
  return { title: t("pageTitle") };
}

export default async function AdminMatrimonialPage() {
  const { profiles, interests, reports, source } = await fetchAdminMatrimonial();
  const stats = computeMatrimonialStats(profiles, interests, reports);
  const t = await getTranslations("matrimonial.admin");

  return (
    <div>
      <PageHeader
        title={t("pageTitle")}
        subtitle={source === "firestore" ? t("subtitleLive") : t("subtitleMock")}
      />
      <MatrimonialPageClient
        initialProfiles={profiles}
        initialReports={reports}
        stats={stats}
        source={source}
      />
    </div>
  );
}
