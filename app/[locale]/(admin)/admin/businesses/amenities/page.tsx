import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { AmenitiesClient } from "@/components/admin/businesses/AmenitiesClient";
import { fetchAmenities } from "@/lib/admin/data/business-taxonomies";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses.admin");
  return { title: t("amenitiesPageTitle") };
}

export default async function AdminAmenitiesPage() {
  const t = await getTranslations("businesses.admin");
  const { amenities, source } = await fetchAmenities();
  return (
    <div>
      <PageHeader title={t("amenitiesPageTitle")} />
      <AmenitiesClient initialAmenities={amenities} canPersist={source === "firestore"} />
    </div>
  );
}
