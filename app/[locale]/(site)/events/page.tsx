import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { fetchPublicEvents } from "@/lib/events/public";
import { PublicEventsList } from "@/components/site/PublicEventsList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("eventsPublic");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EventsListPage() {
  const { events } = await fetchPublicEvents({ windowDays: 60, limit: 100 });
  const t = await getTranslations("eventsPublic");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subheading")}</p>
      </header>
      <PublicEventsList items={events} />
    </div>
  );
}
