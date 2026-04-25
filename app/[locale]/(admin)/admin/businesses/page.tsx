import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { BusinessesPageClient } from "@/components/admin/businesses/BusinessesPageClient";
import { fetchBusinesses } from "@/lib/admin/data/businesses";
import { fetchCategories, fetchAmenities, fetchCertBodies } from "@/lib/admin/data/business-taxonomies";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses");
  return { title: t("pageTitle") };
}

export default async function AdminBusinessesPage() {
  const t = await getTranslations("businesses");
  const [{ businesses, source }, { categories }, { amenities }, { certBodies }] = await Promise.all([
    fetchBusinesses(),
    fetchCategories(),
    fetchAmenities(),
    fetchCertBodies(),
  ]);

  return (
    <div>
      <PageHeader
        title={t("pageTitle")}
        subtitle={source === "firestore" ? t("subtitleLive") : t("subtitleMock")}
      />
      <BusinessesPageClient
        initialBusinesses={businesses}
        categories={categories}
        amenities={amenities}
        certBodies={certBodies}
        canPersist={source === "firestore"}
      />
    </div>
  );
}
