import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminPrayerTimesView } from "@/components/admin/AdminPrayerTimesView";

export default async function Page() {
  const t = await getTranslations("prayerTimesAdmin");
  return (
    <div>
      <PageHeader
        title={t("pageTitle")}
        subtitle={t("pageSubtitle")}
      />
      <AdminPrayerTimesView />
    </div>
  );
}
