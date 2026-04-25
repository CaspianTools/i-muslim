import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Download,
  Globe,
  MapPin,
  Repeat,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchPublicEvent, nextThreeOccurrences } from "@/lib/events/public";
import { describeRRule } from "@/lib/admin/recurrence";
import { getHijriParts } from "@/lib/admin/hijri";
import { RsvpButton } from "@/components/site/RsvpButton";
import { ShareButtons } from "@/components/site/ShareButtons";
import type { EventCategory } from "@/types/admin";

interface PageContext {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageContext): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchPublicEvent(id);
  if (!event) return { title: "Event not found" };
  const t = await getTranslations("eventsPublic");
  return {
    title: t("metaDetailTitle", { name: event.title.en }),
    description: event.description?.en ?? t("metaDescription"),
    openGraph: {
      title: event.title.en,
      description: event.description?.en,
      type: "website",
    },
  };
}

function categoryVariant(category: EventCategory): "accent" | "info" | "success" | "warning" | "danger" | "neutral" {
  switch (category) {
    case "prayer":
      return "accent";
    case "lecture":
    case "class":
      return "info";
    case "iftar":
    case "community":
      return "success";
    case "fundraiser":
      return "warning";
    case "janazah":
      return "danger";
    default:
      return "neutral";
  }
}

export default async function EventDetailPage({ params }: PageContext) {
  const { id } = await params;
  const event = await fetchPublicEvent(id);
  if (!event) notFound();

  const t = await getTranslations("eventsPublic");
  const tCategories = await getTranslations("events.categories");
  const tHijriMonths = await getTranslations("hijri.months");
  const locale = await getLocale();

  const occurrences = nextThreeOccurrences(event);
  const primaryStart = occurrences[0] ?? new Date(event.startsAt);
  const hijri = getHijriParts(primaryStart);
  const dateStr = primaryStart.toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = primaryStart.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const recurrenceLabel = event.hijriAnchor
    ? t("recurrenceHijri", {
        month: tHijriMonths(String(event.hijriAnchor.monthIndex)),
        day: event.hijriAnchor.day,
      })
    : event.recurrence
      ? describeRRule(event.recurrence)
      : null;

  const Icon = event.location.mode === "online" ? Globe : MapPin;
  const where =
    event.location.venue ?? event.location.address ?? event.location.url ?? "—";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title.en,
    description: event.description?.en,
    startDate: primaryStart.toISOString(),
    endDate: event.endsAt ? new Date(event.endsAt).toISOString() : undefined,
    eventAttendanceMode:
      event.location.mode === "online"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : event.location.mode === "hybrid"
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus:
      event.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    location:
      event.location.mode === "online"
        ? {
            "@type": "VirtualLocation",
            url: event.location.url,
          }
        : {
            "@type": "Place",
            name: event.location.venue,
            address: event.location.address,
            geo:
              event.location.lat != null && event.location.lng != null
                ? {
                    "@type": "GeoCoordinates",
                    latitude: event.location.lat,
                    longitude: event.location.lng,
                  }
                : undefined,
          },
    organizer: event.organizer
      ? { "@type": "Organization", name: event.organizer.name }
      : undefined,
    offers: event.capacity
      ? {
          "@type": "Offer",
          availability:
            event.rsvpCount >= event.capacity
              ? "https://schema.org/SoldOut"
              : "https://schema.org/InStock",
        }
      : undefined,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/events"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("backToEvents")}
      </Link>

      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={categoryVariant(event.category)}>
            {tCategories(event.category)}
          </Badge>
          {recurrenceLabel && (
            <Badge variant="neutral">
              <Repeat className="size-3" /> {recurrenceLabel}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {event.title.en}
        </h1>
        {event.title.ar && (
          <p
            dir="rtl"
            lang="ar"
            className="text-xl text-muted-foreground"
          >
            {event.title.ar}
          </p>
        )}
      </header>

      <section className="mt-8 grid gap-3 rounded-xl border border-border bg-muted/20 p-5 text-sm">
        <div className="flex items-start gap-3">
          <CalendarDays className="size-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="font-medium text-foreground tabular-nums">
              {dateStr} · {timeStr}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {hijri.day} {tHijriMonths(String(hijri.monthIndex))} {hijri.year}
            </div>
          </div>
        </div>
        {event.startAnchor && (
          <div className="flex items-start gap-3 text-muted-foreground">
            <Clock className="size-4 mt-0.5" />
            <span>{t("anchorNote", { prayer: event.startAnchor.prayer })}</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <Icon className="size-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-foreground">{where}</div>
            {event.location.address && event.location.venue && (
              <div className="text-xs text-muted-foreground">{event.location.address}</div>
            )}
            {event.location.mode === "online" && event.location.url && (
              <a
                href={event.location.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {event.location.url}
              </a>
            )}
          </div>
        </div>
        {event.organizer && (
          <div className="flex items-start gap-3 text-muted-foreground">
            <User className="size-4 mt-0.5" />
            <span>{event.organizer.name}</span>
          </div>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <RsvpButton
          eventId={event.id}
          initialRsvpCount={event.rsvpCount}
          capacity={event.capacity}
        />
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/events/${event.id}/calendar.ics`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Download className="size-3.5" /> {t("addToCalendar")}
          </a>
          <ShareButtons
            url={`/events/${event.id}`}
            title={event.title.en}
          />
        </div>
      </section>

      {event.description?.en && (
        <section className="mt-10 prose prose-sm max-w-none text-foreground">
          <h2 className="text-lg font-semibold">{t("about")}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {event.description.en}
          </p>
          {event.description.ar && (
            <p
              dir="rtl"
              lang="ar"
              className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground"
            >
              {event.description.ar}
            </p>
          )}
        </section>
      )}

      {occurrences.length > 1 && (
        <section className="mt-10 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">{t("nextOccurrences")}</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {occurrences.slice(1).map((d, i) => (
              <li key={i} className="tabular-nums">
                {d.toLocaleDateString(locale, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                ·{" "}
                {d.toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
