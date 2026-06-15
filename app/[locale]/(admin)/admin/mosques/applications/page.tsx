import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { requirePermission } from "@/lib/permissions/server";
import { listMosqueApplications } from "@/lib/mosques/applications";
import { ApplicationsClient } from "@/components/admin/mosques/ApplicationsClient";

export const metadata: Metadata = { title: "Masjid applications" };

export default async function AdminMosqueApplicationsPage() {
  await requirePermission("mosques.publish");
  const applications = await listMosqueApplications("pending");

  return (
    <div>
      <PageHeader
        title="Masjid applications"
        subtitle="Review claim and registration requests. Approving assigns the applicant as the masjid's manager."
      />
      <div className="mt-6">
        <ApplicationsClient applications={applications} />
      </div>
    </div>
  );
}
