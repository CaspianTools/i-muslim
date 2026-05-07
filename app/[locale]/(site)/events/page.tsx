import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { fetchPublicEvents } from "@/lib/events/public";
import { fetchEventCategories } from "@/lib/admin/data/event-categories";
import { PublicEventsList } from "@/components/site/PublicEventsList";
import { PullToRefresh } from "@/components/site/PullToRefresh";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("eventsPublic");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EventsListPage() {
  const [{ events }, { categories }] = await Promise.all([
    fetchPublicEvents({ windowDays: 60, limit: 100 }),
    fetchEventCategories(),
  ]);
  const t = await getTranslations("eventsPublic");

  return (
    <PullToRefresh>
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subheading")}</p>
        </div>
        <Button asChild size="sm" className="self-start">
          <Link href="/events/submit">
            <Plus />
            {t("submitCta")}
          </Link>
        </Button>
      </header>
      <PublicEventsList items={events} categories={categories} />
    </div>
    </PullToRefresh>
  );
}
