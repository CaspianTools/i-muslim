import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { MosqueForm } from "@/components/admin/mosques/MosqueForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosquesAdmin.form");
  return { title: t("createTitle") };
}

export default async function NewMosquePage() {
  const t = await getTranslations("mosquesAdmin.form");
  return (
    <div>
      <PageHeader title={t("createTitle")} subtitle={t("createDescription")} />
      <MosqueForm mode="create" />
    </div>
  );
}
