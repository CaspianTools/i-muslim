import type { Denomination, MosqueServices, PrayerKey } from "@/types/mosque";

export const MOSQUES_COLLECTION = "mosques";
export const MOSQUE_GEOCODE_CACHE_COLLECTION = "geocodeCache";

export const KAABA_LAT = 21.4225;
export const KAABA_LNG = 39.8262;

export const PRAYER_KEYS: PrayerKey[] = [
  "fajr",
  "dhuhr",
  "jumuah",
  "asr",
  "maghrib",
  "isha",
];

export const DAILY_PRAYER_KEYS: Exclude<PrayerKey, "jumuah">[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

export const DENOMINATIONS: Denomination[] = [
  "unspecified",
  "sunni",
  "shia",
  "ibadi",
  "ahmadi",
  "other",
];

export const SERVICE_KEYS: Array<keyof MosqueServices> = [
  "fridayPrayer",
  "womenSection",
  "wuduFacilities",
  "wheelchairAccess",
  "parking",
  "quranClasses",
  "library",
  "funeralServices",
  "nikahServices",
  "accommodatesItikaf",
];

export function emptyServices(): MosqueServices {
  return {
    fridayPrayer: false,
    womenSection: false,
    wuduFacilities: false,
    wheelchairAccess: false,
    parking: false,
    quranClasses: false,
    library: false,
    funeralServices: false,
    nikahServices: false,
    accommodatesItikaf: false,
  };
}

export const MOSQUE_FACILITIES_COLLECTION = "mosqueFacilities";

/**
 * Slug + label seed list for the `mosqueFacilities` taxonomy. Written once on
 * first admin read if the collection is empty. The slug ordering mirrors
 * SERVICE_KEYS so legacy `services` boolean maps can be deterministically
 * derived into `facilities[]` for back-compat.
 */
export const DEFAULT_MOSQUE_FACILITIES: ReadonlyArray<{
  slug: string;
  name: string;
  legacyKey: keyof MosqueServices;
  iconKey?: string;
}> = [
  { slug: "friday-prayer", name: "Friday prayer", legacyKey: "fridayPrayer" },
  { slug: "womens-section", name: "Women's section", legacyKey: "womenSection" },
  { slug: "wudu-facilities", name: "Wudu facilities", legacyKey: "wuduFacilities" },
  { slug: "wheelchair-access", name: "Wheelchair access", legacyKey: "wheelchairAccess" },
  { slug: "parking", name: "Parking", legacyKey: "parking" },
  { slug: "quran-classes", name: "Quran classes", legacyKey: "quranClasses" },
  { slug: "library", name: "Library", legacyKey: "library" },
  { slug: "funeral-services", name: "Funeral services", legacyKey: "funeralServices" },
  { slug: "nikah-services", name: "Nikah services", legacyKey: "nikahServices" },
  { slug: "itikaf-accommodation", name: "I'tikaf accommodation", legacyKey: "accommodatesItikaf" },
];

const LEGACY_TO_SLUG: Record<keyof MosqueServices, string> = Object.fromEntries(
  DEFAULT_MOSQUE_FACILITIES.map((f) => [f.legacyKey, f.slug]),
) as Record<keyof MosqueServices, string>;

/**
 * Reverse of LEGACY_TO_SLUG: maps a facility slug back to its `mosques.services.*`
 * message key, so renderers can localize a stored facility slug instead of
 * title-casing the raw English slug. Unknown (admin-created) slugs have no entry
 * and fall back to a humanized label.
 */
export const SLUG_TO_LEGACY: Record<string, keyof MosqueServices> = Object.fromEntries(
  DEFAULT_MOSQUE_FACILITIES.map((f) => [f.slug, f.legacyKey]),
) as Record<string, keyof MosqueServices>;

/** Translate a legacy `services` boolean map into the new `facilities[]` slug list. */
export function deriveFacilitiesFromServices(services: Partial<MosqueServices> | undefined): string[] {
  if (!services) return [];
  const out: string[] = [];
  for (const key of SERVICE_KEYS) {
    if (services[key]) out.push(LEGACY_TO_SLUG[key]);
  }
  return out;
}

// Resolved at request time when we need absolute URLs (sitemap, JSON-LD, OG).
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "http://localhost:7777"
  ).replace(/\/$/, "");
}
