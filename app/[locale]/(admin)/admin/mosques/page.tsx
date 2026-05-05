import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { fetchAllMosquesAdmin } from "@/lib/admin/data/mosques";
import { MosquesPageClient } from "@/components/admin/mosques/MosquesPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosquesAdmin");
  return { title: t("pageTitle") };
}

export default async function AdminMosquesPage() {
  const { mosques, source } = await fetchAllMosquesAdmin();
  const t = await getTranslations("mosquesAdmin");

  return (
    <div>
      <PageHeader
        title={t("pageTitle")}
        subtitle={source === "firestore" ? t("subtitleLive") : t("subtitleMock")}
      />
      <MosquesPageClient initialMosques={mosques} />
    </div>
  );
}
