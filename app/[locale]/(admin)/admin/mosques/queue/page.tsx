import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { fetchModerationQueue } from "@/lib/admin/data/mosques";
import { ModerationQueueClient } from "@/components/admin/mosques/ModerationQueueClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosquesAdmin");
  return { title: t("queueTitle") };
}

export default async function QueuePage() {
  const [{ submissions, pendingMosques }, t] = await Promise.all([
    fetchModerationQueue(),
    getTranslations("mosquesAdmin"),
  ]);

  return (
    <div>
      <PageHeader title={t("queueTitle")} subtitle={t("queueSubtitle")} />
      <ModerationQueueClient submissions={submissions} pendingMosques={pendingMosques} />
    </div>
  );
}
