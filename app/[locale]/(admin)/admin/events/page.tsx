import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { EventsPageClient } from "@/components/admin/events/EventsPageClient";
import { fetchEvents } from "@/lib/admin/data/events";
import { fetchEventCategories } from "@/lib/admin/data/event-categories";
import { fetchAllMosquesAdmin } from "@/lib/admin/data/mosques";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");
  return { title: t("pageTitle") };
}

export default async function EventsPage() {
  const [{ events, source }, { categories }, { mosques }] = await Promise.all([
    fetchEvents(),
    fetchEventCategories(),
    fetchAllMosquesAdmin(),
  ]);
  const t = await getTranslations("events");

  // Mosque picker on the event editor only needs the lookup fields, not the
  // full document. Strip aggressively so we don't ship megabytes of cover
  // images / facility maps to the client.
  const mosqueOptions = mosques.map((m) => ({
    slug: m.slug,
    name: m.name.en,
    city: m.city,
    country: m.country,
  }));

  return (
    <div>
      <PageHeader title={t("pageTitle")} />
      <EventsPageClient
        initialEvents={events}
        source={source}
        categories={categories}
        mosques={mosqueOptions}
      />
    </div>
  );
}
