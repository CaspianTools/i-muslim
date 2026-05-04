import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Upload } from "lucide-react";
import { fetchAllMosquesAdmin } from "@/lib/admin/data/mosques";
import { MosquesPageClient } from "@/components/admin/mosques/MosquesPageClient";
import { NewMosqueButton } from "@/components/admin/mosques/NewMosqueButton";

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/mosques/import">
                <Upload /> {t("import")}
              </Link>
            </Button>
            <NewMosqueButton label={t("newMosque")} />
          </div>
        }
      />
      <MosquesPageClient initialMosques={mosques} source={source} />
    </div>
  );
}
