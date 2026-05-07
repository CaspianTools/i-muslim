import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, Plus } from "lucide-react";
import { fetchUpcomingEventsByMosque } from "@/lib/admin/data/events";

interface Props {
  mosqueSlug: string;
  /** When true, shows the "Add event" CTA wired to /events/submit?mosqueId=<slug>. */
  canAddEvent: boolean;
}

const PAGE_SIZE = 5;

export async function MosqueEventsCard({ mosqueSlug, canAddEvent }: Props) {
  const [events, t, locale] = await Promise.all([
    fetchUpcomingEventsByMosque(mosqueSlug, { limit: PAGE_SIZE }),
    getTranslations("mosques.events"),
    getLocale(),
  ]);

  // Suppress the section entirely for non-managers when there's nothing to
  // show — the empty state would just be noise on most mosque pages. Managers
  // still see the card so they have a place to click "Add event".
  if (events.length === 0 && !canAddEvent) return null;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
        {canAddEvent && (
          <Link
            href={`/events/submit?mosqueId=${encodeURIComponent(mosqueSlug)}`}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Plus className="size-3.5" /> {t("addEvent")}
          </Link>
        )}
      </header>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {events.map((event) => {
            const startDate = new Date(event.startsAt);
            const when = Number.isFinite(startDate.getTime())
              ? dateFormatter.format(startDate)
              : event.startsAt;
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-start gap-3 rounded-md border border-transparent p-2 -mx-2 hover:bg-muted/40 hover:border-border"
                >
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.title}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">{when}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
