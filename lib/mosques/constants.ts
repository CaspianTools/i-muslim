import type { Denomination, MosqueServices, PrayerKey } from "@/types/mosque";

export const MOSQUES_COLLECTION = "mosques";
export const MOSQUE_SUBMISSIONS_COLLECTION = "mosqueSubmissions";
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

// Resolved at request time when we need absolute URLs (sitemap, JSON-LD, OG).
export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "http://localhost:7777"
  ).replace(/\/$/, "");
}
