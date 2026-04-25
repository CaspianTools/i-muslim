import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Inbox, Upload } from "lucide-react";
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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/mosques/queue">
                <Inbox /> {t("queue")}
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin/mosques/import">
                <Upload /> {t("import")}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/mosques/new">
                <Plus /> {t("newMosque")}
              </Link>
            </Button>
          </div>
        }
      />
      <MosquesPageClient initialMosques={mosques} source={source} />
    </div>
  );
}
