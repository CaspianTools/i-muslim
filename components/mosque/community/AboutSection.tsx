import type { ComponentType } from "react";
import { getTranslations } from "next-intl/server";
import {
  Accessibility,
  BookOpen,
  CalendarHeart,
  Coffee,
  Droplet,
  Flower2,
  HandCoins,
  HeartHandshake,
  Library,
  ParkingSquare,
  Users,
} from "lucide-react";
import { pickLocalized } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
import { Badge } from "@/components/ui/badge";
import { MosqueMap } from "@/components/mosque/MosqueMap";
import { OpenInMapsLinks } from "@/components/mosque/OpenInMapsLinks";
import type { Mosque } from "@/types/mosque";

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

function humanizeFacility(slug: string): string {
  const cleaned = slug.replace(/[-_]+/g, " ").trim();
  if (!cleaned) return slug;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function hasRealCoordinates(loc: { lat: number; lng: number } | undefined): boolean {
  if (!loc) return false;
  return loc.lat !== 0 || loc.lng !== 0;
}

export async function AboutSection({ mosque, locale }: { mosque: Mosque; locale: string }) {
  const t = await getTranslations("mosques.detail");
  const tc = await getTranslations("mosques.community");

  const about = mosque.about?.trim();
  const localizedDesc = mosque.description
    ? pickLocalized(mosque.description, locale, "en") ?? mosque.description.en
    : undefined;
  const facilities = mosque.facilities ?? [];
  const showMap = hasRealCoordinates(mosque.location);

  return (
    <section id="about" className="mq-card mq-card-pad scroll-mt-24 space-y-5">
      <h2 className="mq-rail-title">{tc("aboutTitle")}</h2>

      {about && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{about}</p>
      )}
      {localizedDesc && (
        <p
          dir={locale === "ar" ? "rtl" : "ltr"}
          className={locale === "ar" ? "font-arabic text-base" : "text-sm text-muted-foreground"}
        >
          {localizedDesc}
        </p>
      )}

      {facilities.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">{t("facilities")}</h3>
          <ul className="flex flex-wrap gap-2">
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
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">{t("address")}</h3>
        <address className="not-italic text-sm text-muted-foreground">
          <div>{mosque.address.line1}</div>
          {mosque.address.line2 && <div>{mosque.address.line2}</div>}
          <div>
            {mosque.city}
            {mosque.region ? `, ${mosque.region}` : ""}
            {mosque.address.postalCode ? ` ${mosque.address.postalCode}` : ""}
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
      </div>

      {(mosque.languages.length > 0 || mosque.capacity) && (
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {mosque.languages.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t("languages")}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {mosque.languages.map((l) => (
                  <li key={l}>
                    <Badge variant="neutral">{l.toUpperCase()}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mosque.capacity && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{t("capacity")}</h3>
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" /> {t("capacityValue", { count: mosque.capacity })}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
