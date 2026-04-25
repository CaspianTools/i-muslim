import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { MosqueForm } from "@/components/admin/mosques/MosqueForm";
import { fetchMosqueBySlug } from "@/lib/admin/data/mosques";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { mosque } = await fetchMosqueBySlug(slug);
  const t = await getTranslations("mosquesAdmin.form");
  return { title: mosque ? `${t("editTitle")} — ${mosque.name.en}` : t("editTitle") };
}

export default async function EditMosquePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ mosque }, t] = await Promise.all([
    fetchMosqueBySlug(slug),
    getTranslations("mosquesAdmin.form"),
  ]);
  if (!mosque) notFound();

  return (
    <div>
      <PageHeader
        title={`${t("editTitle")} — ${mosque.name.en}`}
        subtitle={t("editDescription")}
      />
      <MosqueForm mode="edit" initial={mosque} />
    </div>
  );
}
