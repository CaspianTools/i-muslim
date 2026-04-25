import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule as AdhanHighLatRule,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from "adhan";
import type { AsrMethod, CalcMethod, HighLatitudeRule, Mosque, PrayerCalcConfig } from "@/types/mosque";

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

export function computeAdhan(mosque: Pick<Mosque, "location" | "prayerCalc">, date: Date = new Date()): ComputedAdhan {
  const calc = mosque.prayerCalc ?? DEFAULT_CALC;
  const coords = new Coordinates(mosque.location.lat, mosque.location.lng);
  const times = new PrayerTimes(coords, date, paramsFor(calc));
  return {
    fajr: times.fajr,
    sunrise: times.sunrise,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
}

const ASR_METHODS: AsrMethod[] = ["shafi", "hanafi"];
export function isAsrMethod(v: unknown): v is AsrMethod {
  return typeof v === "string" && ASR_METHODS.includes(v as AsrMethod);
}

export function defaultPrayerCalc(): PrayerCalcConfig {
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
