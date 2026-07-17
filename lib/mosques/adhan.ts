import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule as AdhanHighLatRule,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from "adhan";
import type { AsrMethod, CalcMethod, Denomination, HighLatitudeRule, Mosque, PrayerCalcConfig } from "@/types/mosque";

type AdhanHighLatValue = (typeof AdhanHighLatRule)[keyof typeof AdhanHighLatRule];

const DEFAULT_CALC: PrayerCalcConfig = {
  method: "MWL",
  asrMethod: "shafi",
  highLatitudeRule: "MIDDLE_OF_NIGHT",
};

function paramsFor(calc: PrayerCalcConfig): CalculationParameters {
  const params = pickMethod(calc.method);
  params.madhab = calc.asrMethod === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = pickHighLat(calc.highLatitudeRule);
  return params;
}

function pickMethod(method: CalcMethod): CalculationParameters {
  switch (method) {
    case "ISNA":
      return CalculationMethod.NorthAmerica();
    case "EGYPT":
      return CalculationMethod.Egyptian();
    case "MAKKAH":
      return CalculationMethod.UmmAlQura();
    case "KARACHI":
      return CalculationMethod.Karachi();
    case "TEHRAN":
      return CalculationMethod.Tehran();
    case "JAFARI":
      return CalculationMethod.Tehran();
    case "MWL":
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

function pickHighLat(rule: HighLatitudeRule): AdhanHighLatValue {
  switch (rule) {
    case "ANGLE_BASED":
      return AdhanHighLatRule.TwilightAngle;
    case "ONE_SEVENTH":
      return AdhanHighLatRule.SeventhOfTheNight;
    case "MIDDLE_OF_NIGHT":
    default:
      return AdhanHighLatRule.MiddleOfTheNight;
  }
}

export interface ComputedAdhan {
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

/**
 * Return a Date whose *local* Y/M/D components equal the calendar day of
 * `instant` in `timeZone`. `adhan` derives the target day from the input's
 * getFullYear/getMonth/getDate (runtime-local — UTC on Cloud Run), so a bare
 * `new Date()` computes times for the UTC calendar day, which is the wrong day
 * for a mosque whose local date differs (e.g. UTC+13 / UTC-10 during the daily
 * offset window). Rebuilding via the local Date constructor makes those getters
 * return the mosque-local day regardless of the server's timezone; adhan then
 * emits correct absolute instants for that day.
 */
function anchorToZone(instant: Date, timeZone: string | null | undefined): Date {
  if (!timeZone) return instant;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const val = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const y = val("year");
    const m = val("month");
    const d = val("day");
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return instant;
    // Noon avoids any edge slippage; adhan reads only the Y/M/D components.
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  } catch {
    return instant;
  }
}

export function computeAdhan(
  mosque: Pick<Mosque, "location" | "prayerCalc"> & { timezone?: string | null },
  date: Date = new Date(),
): ComputedAdhan {
  const calc = mosque.prayerCalc ?? DEFAULT_CALC;
  const coords = new Coordinates(mosque.location.lat, mosque.location.lng);
  const times = new PrayerTimes(coords, anchorToZone(date, mosque.timezone), paramsFor(calc));
  return {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
}

// Option lists for the prayer-calc selectors (admin editor, manager Manage
// panel, public submit form). Single source of truth so the three UIs stay in
// sync with the `CalcMethod`/`AsrMethod`/`HighLatitudeRule` unions.
export const CALC_METHODS: CalcMethod[] = ["MWL", "ISNA", "EGYPT", "MAKKAH", "KARACHI", "TEHRAN", "JAFARI"];
export const ASR_METHODS: AsrMethod[] = ["shafi", "hanafi"];
export const HIGH_LAT_RULES: HighLatitudeRule[] = ["MIDDLE_OF_NIGHT", "ANGLE_BASED", "ONE_SEVENTH"];

export function isAsrMethod(v: unknown): v is AsrMethod {
  return typeof v === "string" && ASR_METHODS.includes(v as AsrMethod);
}

export function defaultPrayerCalc(): PrayerCalcConfig {
  return { ...DEFAULT_CALC };
}

const GCC = new Set(["SA", "AE", "BH", "KW", "OM", "QA", "YE"]);
const SOUTH_ASIA_HANAFI = new Set(["PK", "BD", "IN", "AF"]);
const NORTH_AMERICA = new Set(["US", "CA"]);
const EGYPT_REGION = new Set(["EG", "SD", "LY", "TN"]);
const SHIA_REGION = new Set(["IR", "IQ"]);

export function suggestPrayerCalc(country: string, denomination: Denomination): PrayerCalcConfig {
  const cc = (country ?? "").toUpperCase();
  if (GCC.has(cc)) return { method: "MAKKAH", asrMethod: "shafi", highLatitudeRule: "MIDDLE_OF_NIGHT" };
  if (SOUTH_ASIA_HANAFI.has(cc)) return { method: "KARACHI", asrMethod: "hanafi", highLatitudeRule: "MIDDLE_OF_NIGHT" };
  if (NORTH_AMERICA.has(cc)) return { method: "ISNA", asrMethod: "shafi", highLatitudeRule: "ANGLE_BASED" };
  if (EGYPT_REGION.has(cc)) return { method: "EGYPT", asrMethod: "shafi", highLatitudeRule: "MIDDLE_OF_NIGHT" };
  if (SHIA_REGION.has(cc) && denomination === "shia") {
    return { method: "TEHRAN", asrMethod: "shafi", highLatitudeRule: "MIDDLE_OF_NIGHT" };
  }
  return { ...DEFAULT_CALC };
}

export function formatTimeInZone(date: Date, timezone: string, locale: string = "en-US"): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
}
