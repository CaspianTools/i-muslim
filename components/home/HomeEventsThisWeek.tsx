import { getLocale, getTranslations } from "next-intl/server";
import { fetchPublicEvents } from "@/lib/events/public";
import { HomeSection } from "./HomeSection";
import { HomeEventsRefiner } from "./HomeEventsRefiner";
import type { SerializableEvent } from "./home-event-shapes";
import type { PublicEventListItem } from "@/lib/events/public";

const MAX_EVENTS = 6;

export async function HomeEventsThisWeek() {
  const [t, locale, { events }] = await Promise.all([
    getTranslations("home.eventsThisWeek"),
    getLocale(),
    fetchPublicEvents({ windowDays: 7, limit: 50 }),
  ]);
  if (events.length === 0) return null;

  // Events arrive already sorted by soonest start. Location-based "near me"
  // re-sorting happens client-side in HomeEventsRefiner using the visitor's
  // real browser geolocation — the old server-side ipapi.co lookup only ever
  // saw the datacenter IP, so it mislabeled the heading and cost a blocking
  // external call on every render.
  const initial = events.slice(0, MAX_EVENTS);
  const heading = t("headingGlobal");

  return (
    <HomeSection
      heading={heading}
      subheading={t("subheading")}
      viewAllHref="/events"
      viewAllLabel={t("viewAll")}
    >
      <HomeEventsRefiner
        items={serialize(initial)}
        all={serialize(events)}
        max={MAX_EVENTS}
        locale={locale}
        translations={{
          dateNotice: t("subheading"),
          kmAway: t("kmAway"),
          venueOnline: t("venueOnline"),
        }}
      />
    </HomeSection>
  );
}

function serialize(items: PublicEventListItem[]): SerializableEvent[] {
  return items.map(({ event, nextStartsAt }) => ({
    id: event.id,
    title: event.title,
    nextStartsAt,
    venue: event.location.venue ?? null,
    address: event.location.address ?? null,
    mode: event.location.mode,
    lat: event.location.lat ?? null,
    lng: event.location.lng ?? null,
  }));
}
