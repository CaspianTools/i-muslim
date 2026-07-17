import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from "adhan";

export type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export type PrayerOrSunrise = PrayerKey | "sunrise";

export type MethodKey =
  | "MuslimWorldLeague"
  | "Egyptian"
  | "Karachi"
  | "UmmAlQura"
  | "Dubai"
  | "MoonsightingCommittee"
  | "NorthAmerica"
  | "Kuwait"
  | "Qatar"
  | "Singapore"
  | "Tehran"
  | "Turkey";

export type MadhabKey = "shafi" | "hanafi";

export type HighLatRuleKey =
  | "middleofthenight"
  | "seventhofthenight"
  | "twilightangle";

export interface Coords {
  lat: number;
  lng: number;
}

export interface ComputeInput {
  date: Date;
  coords: Coords;
  method: MethodKey;
  madhab: MadhabKey;
  tz: string;
  highLatitudeRule?: HighLatRuleKey;
}

export interface DailyTimes {
  date: Date;
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
  coords: Coords;
  method: MethodKey;
  madhab: MadhabKey;
  tz: string;
  highLatRuleApplied: HighLatRuleKey;
  highLatRuleAuto: boolean;
}

export interface NextPrayer {
  key: PrayerKey;
  at: Date;
  isTomorrow: boolean;
  minutesUntil: number;
}

export const HIGH_LAT_THRESHOLD = 48;

const METHOD_FACTORIES: Record<MethodKey, () => CalculationParameters> = {
  MuslimWorldLeague: CalculationMethod.MuslimWorldLeague,
  Egyptian: CalculationMethod.Egyptian,
  Karachi: CalculationMethod.Karachi,
  UmmAlQura: CalculationMethod.UmmAlQura,
  Dubai: CalculationMethod.Dubai,
  MoonsightingCommittee: CalculationMethod.MoonsightingCommittee,
  NorthAmerica: CalculationMethod.NorthAmerica,
  Kuwait: CalculationMethod.Kuwait,
  Qatar: CalculationMethod.Qatar,
  Singapore: CalculationMethod.Singapore,
  Tehran: CalculationMethod.Tehran,
  Turkey: CalculationMethod.Turkey,
};

function pickHighLatRule(
  lat: number,
  override?: HighLatRuleKey,
): { rule: HighLatRuleKey; auto: boolean } {
  if (override) return { rule: override, auto: false };
  if (Math.abs(lat) > HIGH_LAT_THRESHOLD) {
    return { rule: "twilightangle", auto: true };
  }
  return { rule: "middleofthenight", auto: true };
}

export function computeDailyTimes(input: ComputeInput): DailyTimes {
  const { date, coords, method, madhab, tz, highLatitudeRule } = input;

  const params = METHOD_FACTORIES[method]();
  params.madhab = madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  const { rule, auto } = pickHighLatRule(coords.lat, highLatitudeRule);
  params.highLatitudeRule =
    rule === "twilightangle"
      ? HighLatitudeRule.TwilightAngle
      : rule === "seventhofthenight"
        ? HighLatitudeRule.SeventhOfTheNight
        : HighLatitudeRule.MiddleOfTheNight;

  const c = new Coordinates(coords.lat, coords.lng);
  const pt = new PrayerTimes(c, date, params);

  return {
    date,
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
    coords,
    method,
    madhab,
    tz,
    highLatRuleApplied: rule,
    highLatRuleAuto: auto,
  };
}

export function getNextPrayer(
  now: Date,
  today: DailyTimes,
  tomorrow: DailyTimes,
): NextPrayer {
  const order: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  for (const key of order) {
    const at = today[key];
    if (at.getTime() > now.getTime()) {
      return {
        key,
        at,
        isTomorrow: false,
        minutesUntil: Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000)),
      };
    }
  }
  const at = tomorrow.fajr;
  return {
    key: "fajr",
    at,
    isTomorrow: true,
    minutesUntil: Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000)),
  };
}

export function getCurrentPrayer(now: Date, today: DailyTimes): PrayerKey | null {
  const order: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  // Between midnight and today's Fajr we're still inside the previous night's
  // Isha window (Isha runs until the next Fajr), so the current prayer is Isha —
  // not "nothing", which is what iterating only today's Fajr→Isha would return.
  if (now.getTime() < today.fajr.getTime()) return "isha";
  let current: PrayerKey | null = null;
  for (const key of order) {
    if (today[key].getTime() <= now.getTime()) current = key;
    else break;
  }
  return current;
}

export function formatPrayerTime(at: Date, tz: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(at);
}

export function formatCountdown(minutes: number): string {
  if (minutes < 1) return "now";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
