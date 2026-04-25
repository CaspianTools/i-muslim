import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { CsvImportClient } from "@/components/admin/mosques/CsvImportClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosquesAdmin.import");
  return { title: t("title") };
}

export default async function ImportPage() {
  const t = await getTranslations("mosquesAdmin.import");
  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <CsvImportClient />
    </div>
  );
}
