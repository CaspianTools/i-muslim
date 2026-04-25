import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { EventsPageClient } from "@/components/admin/events/EventsPageClient";
import { fetchEvents } from "@/lib/admin/data/events";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");
  return { title: t("pageTitle") };
}

export default async function EventsPage() {
  const { events, source } = await fetchEvents();
  const t = await getTranslations("events");

  return (
    <div>
      <PageHeader
        title={t("pageTitle")}
        subtitle={source === "firestore" ? t("subtitleLive") : t("subtitleMock")}
      />
      <EventsPageClient initialEvents={events} source={source} />
    </div>
  );
}
