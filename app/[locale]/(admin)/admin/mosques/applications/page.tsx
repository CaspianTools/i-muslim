import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { requirePermission } from "@/lib/permissions/server";
import { listMosqueApplications } from "@/lib/mosques/applications";
import { ApplicationsClient } from "@/components/admin/mosques/ApplicationsClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosquesAdmin.applications");
  return { title: t("pageTitle") };
}

export default async function AdminMosqueApplicationsPage() {
  await requirePermission("mosques.publish");
  const applications = await listMosqueApplications("pending");
  const t = await getTranslations("mosquesAdmin.applications");

  return (
    <div>
      <PageHeader
        title={t("pageTitle")}
        subtitle={t("pageSubtitle")}
      />
      <div className="mt-6">
        <ApplicationsClient applications={applications} />
      </div>
    </div>
  );
}
