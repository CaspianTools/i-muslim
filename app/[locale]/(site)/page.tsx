import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { fetchPublicEvents } from "@/lib/events/public";
import { getHijriParts } from "@/lib/admin/hijri";

export default async function Home() {
  const t = await getTranslations("home");
  const tEvents = await getTranslations("eventsPublic");
  const tHijriMonths = await getTranslations("hijri.months");
  const locale = await getLocale();
  const { events } = await fetchPublicEvents({ windowDays: 14, limit: 3 });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
      <section className="text-center">
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-4xl text-accent sm:text-5xl"
        >
          {t("bismillah")}
        </p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("headline")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          {t("tagline")}
        </p>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ToolCard
          href="/prayer-times"
          title={t("cards.prayerTimes.title")}
          description={t("cards.prayerTimes.description")}
        />
        <ToolCard
          href="/quran"
          title={t("cards.quran.title")}
          description={t("cards.quran.description")}
        />
        <ToolCard
          href="/hadith"
          title={t("cards.hadith.title")}
          description={t("cards.hadith.description")}
        />
        <ToolCard
          href="/zakat"
          title={t("cards.zakat.title")}
          description={t("cards.zakat.description")}
        />
      </section>

      {events.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                {tEvents("featuredHeading")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tEvents("featuredSubheading")}
              </p>
            </div>
            <Link
              href="/events"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {tEvents("viewAll")} <ArrowRight className="size-3.5 rtl:rotate-180" />
            </Link>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {events.map(({ event, nextStartsAt }) => {
              const start = new Date(nextStartsAt);
              const hijri = getHijriParts(start);
              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="block h-full rounded-xl border border-border bg-background p-5 transition-colors hover:border-accent"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                      <CalendarDays className="size-3.5" />
                      <span>
                        {start.toLocaleDateString(locale, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        ·{" "}
                        {start.toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-foreground line-clamp-2">
                      {event.title.en}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {hijri.day} {tHijriMonths(String(hijri.monthIndex))} {hijri.year}
                    </p>
                    {event.location.venue && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                        {event.location.venue}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function ToolCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-background p-6 transition-colors hover:border-accent"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}
