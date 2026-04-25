import type { IqamahRule, Mosque, PrayerKey } from "@/types/mosque";
import { computeAdhan, formatTimeInZone, type ComputedAdhan } from "./adhan";

export interface ResolvedIqamahRow {
  prayer: PrayerKey;
  adhanLabel: string | null;
  iqamahLabel: string | null;
}

function parseHmInTimezone(time: string, day: Date, timezone: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const datePart = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(day);
  // Build a UTC instant assuming the local time is in `timezone`.
  // Use Date#parse with explicit offset by computing the offset between UTC and timezone for that day.
  const utc = new Date(`${datePart}T${m[1]!.padStart(2, "0")}:${m[2]}:00Z`);
  const offsetMin = tzOffsetMinutes(timezone, utc);
  return new Date(utc.getTime() - offsetMin * 60_000);
}

function tzOffsetMinutes(timezone: string, at: Date): number {
  // Returns the offset in minutes such that local = utc + offset.
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (local - at.getTime()) / 60_000;
}

function applyRule(
  prayer: Exclude<PrayerKey, "jumuah">,
  rule: IqamahRule,
  adhan: ComputedAdhan,
  day: Date,
  timezone: string,
): Date | null {
  if (rule.mode === "fixed") {
    return parseHmInTimezone(rule.time, day, timezone);
  }
  const base = adhan[prayer];
  return new Date(base.getTime() + rule.minutesAfterAdhan * 60_000);
}

export interface ResolveOptions {
  date?: Date;
  locale?: string;
  includeJumuah?: boolean;
}

export function resolveAdhanAndIqamah(
  mosque: Pick<Mosque, "location" | "timezone" | "prayerCalc" | "iqamah">,
  opts: ResolveOptions = {},
): ResolvedIqamahRow[] {
  const day = opts.date ?? new Date();
  const locale = opts.locale ?? "en-US";
  const adhan = computeAdhan(mosque, day);
  const tz = mosque.timezone ?? "UTC";

  const rows: ResolvedIqamahRow[] = [
    rowFor("fajr", adhan, mosque.iqamah?.fajr, day, tz, locale),
    rowFor("dhuhr", adhan, mosque.iqamah?.dhuhr, day, tz, locale),
    rowFor("asr", adhan, mosque.iqamah?.asr, day, tz, locale),
    rowFor("maghrib", adhan, mosque.iqamah?.maghrib, day, tz, locale),
    rowFor("isha", adhan, mosque.iqamah?.isha, day, tz, locale),
  ];

  const isFriday = isFridayInZone(day, tz);
  if ((opts.includeJumuah ?? true) && isFriday && mosque.iqamah?.jumuah) {
    const j = mosque.iqamah.jumuah;
    let when: Date | null = null;
    if (j.mode === "fixed") {
      when = parseHmInTimezone(j.time, day, tz);
    } else {
      when = new Date(adhan.dhuhr.getTime() + j.minutesAfterAdhan * 60_000);
    }
    rows.push({
      prayer: "jumuah",
      adhanLabel: formatTimeInZone(adhan.dhuhr, tz, locale),
      iqamahLabel: when ? formatTimeInZone(when, tz, locale) : null,
    });
  }

  return rows;
}

function rowFor(
  prayer: Exclude<PrayerKey, "jumuah">,
  adhan: ComputedAdhan,
  rule: IqamahRule | undefined,
  day: Date,
  tz: string,
  locale: string,
): ResolvedIqamahRow {
  const adhanLabel = formatTimeInZone(adhan[prayer], tz, locale);
  if (!rule) return { prayer, adhanLabel, iqamahLabel: null };
  const iq = applyRule(prayer, rule, adhan, day, tz);
  return { prayer, adhanLabel, iqamahLabel: iq ? formatTimeInZone(iq, tz, locale) : null };
}

function isFridayInZone(date: Date, timezone: string): boolean {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).format(date);
  return day.toLowerCase().startsWith("fri");
}
