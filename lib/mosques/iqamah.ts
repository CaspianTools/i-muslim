import type { Mosque, PrayerKey } from "@/types/mosque";
import { computeAdhan, formatTimeInZone } from "./adhan";

export interface ResolvedAdhanRow {
  prayer: PrayerKey;
  adhanLabel: string | null;
  /** Manager-set Jama'ah / Iqamah time ("HH:mm" local), or null if not set. */
  iqamahLabel: string | null;
}

export interface ResolveOptions {
  date?: Date;
  locale?: string;
  includeJumuah?: boolean;
}

export function resolveAdhan(
  mosque: Pick<Mosque, "location" | "timezone" | "prayerCalc" | "iqamah">,
  opts: ResolveOptions = {},
): ResolvedAdhanRow[] {
  const day = opts.date ?? new Date();
  const locale = opts.locale ?? "en-US";
  const adhan = computeAdhan(mosque, day);
  const tz = mosque.timezone ?? "UTC";
  const iqamah = mosque.iqamah;

  const rows: ResolvedAdhanRow[] = [
    { prayer: "fajr", adhanLabel: formatTimeInZone(adhan.fajr, tz, locale), iqamahLabel: iqamah?.fajr ?? null },
    { prayer: "dhuhr", adhanLabel: formatTimeInZone(adhan.dhuhr, tz, locale), iqamahLabel: iqamah?.dhuhr ?? null },
    { prayer: "asr", adhanLabel: formatTimeInZone(adhan.asr, tz, locale), iqamahLabel: iqamah?.asr ?? null },
    { prayer: "maghrib", adhanLabel: formatTimeInZone(adhan.maghrib, tz, locale), iqamahLabel: iqamah?.maghrib ?? null },
    { prayer: "isha", adhanLabel: formatTimeInZone(adhan.isha, tz, locale), iqamahLabel: iqamah?.isha ?? null },
  ];

  if ((opts.includeJumuah ?? true) && isFridayInZone(day, tz)) {
    rows.push({
      prayer: "jumuah",
      adhanLabel: formatTimeInZone(adhan.dhuhr, tz, locale),
      iqamahLabel: iqamah?.jumuah && iqamah.jumuah.length > 0 ? iqamah.jumuah.join(", ") : null,
    });
  }

  return rows;
}

function isFridayInZone(date: Date, timezone: string): boolean {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(date);
  return day.toLowerCase().startsWith("fri");
}
