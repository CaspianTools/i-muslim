import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { CertBodiesClient } from "@/components/admin/businesses/CertBodiesClient";
import { fetchCertBodies } from "@/lib/admin/data/business-taxonomies";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses.admin");
  return { title: t("certBodiesPageTitle") };
}

export default async function AdminCertBodiesPage() {
  const t = await getTranslations("businesses.admin");
  const { certBodies, source } = await fetchCertBodies();
  return (
    <div>
      <PageHeader title={t("certBodiesPageTitle")} />
      <CertBodiesClient initialCertBodies={certBodies} canPersist={source === "firestore"} />
    </div>
  );
}
