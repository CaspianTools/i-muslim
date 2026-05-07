"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  Accessibility,
  BookOpen,
  CalendarHeart,
  Coffee,
  Droplet,
  Flower2,
  Globe,
  HandCoins,
  HeartHandshake,
  Library,
  Mail,
  MapPin,
  ParkingSquare,
  Phone,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { pickLocalized } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
import { Badge } from "@/components/ui/badge";
import { MosqueMap } from "@/components/mosque/MosqueMap";
import { OpenInMapsLinks } from "@/components/mosque/OpenInMapsLinks";
import { PrayerTimesPanel } from "@/components/mosque/PrayerTimesPanel";
import type { Mosque } from "@/types/mosque";

function hasRealCoordinates(loc: { lat: number; lng: number } | undefined): boolean {
  if (!loc) return false;
  return loc.lat !== 0 || loc.lng !== 0;
}

/**
 * Render a facility slug as a human-friendly label. The public profile doesn't
 * fetch the admin facility taxonomy, so display falls back to a humanized slug
 * — good enough for the bulk of common cases ("friday-prayer" → "Friday prayer").
 */
function humanizeFacility(slug: string): string {
  const cleaned = slug.replace(/[-_]+/g, " ").trim();
  if (!cleaned) return slug;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Best-effort icon for the seeded facility slugs from
// `lib/admin/data/mosque-facilities.ts`. Unknown slugs (admin-defined later)
// fall back to a neutral icon. Keeping this lookup local — moving it to the
// admin taxonomy module would couple public render to that module's auth path.
const FACILITY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "friday-prayer": CalendarHeart,
  "womens-section": HeartHandshake,
  "wudu-facilities": Droplet,
  "wheelchair-access": Accessibility,
  parking: ParkingSquare,
  "quran-classes": BookOpen,
  library: Library,
  "funeral-services": Flower2,
  "nikah-services": HandCoins,
  "itikaf-accommodation": Coffee,
};

export function MosqueProfile({
  mosque,
  eventsSlot,
}: {
  mosque: Mosque;
  /**
   * Server-rendered events card injected by the parent page so this client
   * component can stay client-side without dragging in firebase-admin.
   */
  eventsSlot?: React.ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations("mosques.detail");
  const tDenomination = useTranslations("mosques.denominations");
  const tActions = useTranslations("mosques.actions");

  const facilities = mosque.facilities ?? [];

  const localizedName = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;
  const localizedDesc = mosque.description
    ? pickLocalized(mosque.description, locale, "en") ?? mosque.description.en
    : undefined;
  const isVerified = Boolean(mosque.moderation?.reviewedAt);
  const showMap = hasRealCoordinates(mosque.location);

  return (
    <div className="space-y-8">
      <header className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{tDenomination(mosque.denomination)}</Badge>
            {isVerified ? (
              <Badge variant="success">{t("verified")}</Badge>
            ) : (
              <Badge variant="warning">{t("unverified")}</Badge>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{localizedName}</h1>
          {mosque.name.ar && locale !== "ar" && (
            <p dir="rtl" lang="ar" className="font-arabic text-2xl text-accent">
              {mosque.name.ar}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" /> {mosque.city}, {countryName(mosque.country)}
          </p>
          {localizedDesc && (
            <p
              dir={locale === "ar" ? "rtl" : "ltr"}
              className={locale === "ar" ? "font-arabic text-base" : "text-base text-muted-foreground"}
            >
              {localizedDesc}
            </p>
          )}
        </div>
        {mosque.coverImage?.url && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
            <Image
              src={mosque.coverImage.url}
              alt=""
              fill
              sizes="(min-width: 768px) 320px, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <PrayerTimesPanel mosque={mosque} locale={locale} />

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">{t("address")}</h2>
            <address className="mt-2 not-italic text-sm text-muted-foreground">
              <div>{mosque.address.line1}</div>
              {mosque.address.line2 && <div>{mosque.address.line2}</div>}
              <div>
                {mosque.city}{mosque.region ? `, ${mosque.region}` : ""}{mosque.address.postalCode ? ` ${mosque.address.postalCode}` : ""}
              </div>
              <div>{countryName(mosque.country)}</div>
            </address>
            {showMap && (
              <>
                <div className="mt-3">
                  <OpenInMapsLinks lat={mosque.location.lat} lng={mosque.location.lng} label={mosque.name.en} />
                </div>
                <div className="mt-4">
                  <MosqueMap lat={mosque.location.lat} lng={mosque.location.lng} label={mosque.name.en} />
                </div>
              </>
            )}
          </section>

          {eventsSlot}

          {facilities.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("facilities")}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {facilities.map((slug) => {
                  const Icon = FACILITY_ICONS[slug] ?? Coffee;
                  return (
                    <li key={slug}>
                      <span className="facility-chip">
                        <Icon />
                        {humanizeFacility(slug)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {(mosque.contact?.phone || mosque.contact?.email || mosque.contact?.website) && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("contact")}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {mosque.contact?.phone && (
                  <li>
                    <a
                      href={`tel:${mosque.contact.phone}`}
                      className="inline-flex items-center gap-2 text-foreground hover:text-accent"
                    >
                      <Phone className="size-4" /> {mosque.contact.phone}
                    </a>
                  </li>
                )}
                {mosque.contact?.email && (
                  <li>
                    <a
                      href={`mailto:${mosque.contact.email}`}
                      className="inline-flex items-center gap-2 text-foreground hover:text-accent"
                    >
                      <Mail className="size-4" /> {tActions("emailMosque")}
                    </a>
                  </li>
                )}
                {mosque.contact?.website && (
                  <li>
                    <a
                      href={mosque.contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-foreground hover:text-accent"
                    >
                      <Globe className="size-4" /> {tActions("visitWebsite")}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}

          {mosque.languages.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("languages")}</h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {mosque.languages.map((l) => (
                  <li key={l}>
                    <Badge variant="neutral">{l.toUpperCase()}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mosque.capacity && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("capacity")}</h2>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                {t("capacityValue", { count: mosque.capacity })}
              </p>
            </section>
          )}

          <section className="rounded-xl border border-dashed border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">{t("reportTitle")}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{t("reportNote")}</p>
            <a
              href={`mailto:admin@i-muslim.app?subject=${encodeURIComponent(`Report: ${mosque.name.en} (${mosque.slug})`)}`}
              className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              {tActions("report")}
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
