import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { fetchUpcomingEventsByMosque } from "@/lib/admin/data/events";

interface Props {
  mosqueSlug: string;
  /** When true, shows the "Add event" CTA wired to /events/submit?mosqueId=<slug>. */
  canAddEvent: boolean;
  /** Max events to list (5 in the rail, larger on the Events view). */
  limit?: number;
  /** When set, shows a "View all events" link (rail usage). */
  viewAllHref?: string;
  /** Force the empty state even for visitors (the dedicated Events view). */
  showWhenEmpty?: boolean;
}

export async function MosqueEventsCard({
  mosqueSlug,
  canAddEvent,
  limit = 5,
  viewAllHref,
  showWhenEmpty = false,
}: Props) {
  const [events, t, locale] = await Promise.all([
    fetchUpcomingEventsByMosque(mosqueSlug, { limit }),
    getTranslations("mosques.events"),
    getLocale(),
  ]);

  // Suppress the section entirely for non-managers when there's nothing to
  // show — the empty state would just be noise in the rail. Managers still see
  // the card (to click "Add event"), and the dedicated Events view forces it.
  if (events.length === 0 && !canAddEvent && !showWhenEmpty) return null;

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="mq-card mq-card-pad">
      <header className="mq-rail-title">
        <span>{t("title")}</span>
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
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const startDate = new Date(event.startsAt);
            const when = Number.isFinite(startDate.getTime())
              ? dateFormatter.format(startDate)
              : event.startsAt;
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="-mx-2 flex items-start gap-3 rounded-md border border-transparent p-2 hover:border-border hover:bg-muted/40"
                >
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{when}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {viewAllHref && events.length > 0 && (
        <Link
          href={viewAllHref}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          {t("viewAll")} <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      )}
    </section>
  );
}
