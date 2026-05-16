import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import {
  computeDailyTimes,
  type HighLatRuleKey,
  type MadhabKey,
  type MethodKey,
} from "@/lib/prayer/engine";

export const runtime = "nodejs";

const VALID_METHODS: MethodKey[] = [
  "MuslimWorldLeague",
  "Egyptian",
  "Karachi",
  "UmmAlQura",
  "Dubai",
  "MoonsightingCommittee",
  "NorthAmerica",
  "Kuwait",
  "Qatar",
  "Singapore",
  "Tehran",
  "Turkey",
];
const VALID_MADHABS: MadhabKey[] = ["shafi", "hanafi"];
const VALID_HIGH_LAT: HighLatRuleKey[] = ["middleofthenight", "seventhofthenight", "twilightangle"];

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req, "prayer-times", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return withCors(apiError("VALIDATION_ERROR", "lat and lng query params required and valid", 400));
  }

  const method = (url.searchParams.get("method") ?? "MuslimWorldLeague") as MethodKey;
  if (!VALID_METHODS.includes(method)) {
    return withCors(apiError("VALIDATION_ERROR", `Invalid method. Allowed: ${VALID_METHODS.join(", ")}`, 400));
  }
  const madhab = (url.searchParams.get("madhab") ?? "shafi") as MadhabKey;
  if (!VALID_MADHABS.includes(madhab)) {
    return withCors(apiError("VALIDATION_ERROR", `Invalid madhab. Allowed: ${VALID_MADHABS.join(", ")}`, 400));
  }
  const highLatRaw = url.searchParams.get("highLatitudeRule") ?? undefined;
  const highLatitudeRule = highLatRaw ? (highLatRaw as HighLatRuleKey) : undefined;
  if (highLatitudeRule && !VALID_HIGH_LAT.includes(highLatitudeRule)) {
    return withCors(
      apiError("VALIDATION_ERROR", `Invalid highLatitudeRule. Allowed: ${VALID_HIGH_LAT.join(", ")}`, 400),
    );
  }
  const tz = url.searchParams.get("timezone") ?? "UTC";
  const dateParam = url.searchParams.get("date");
  let date: Date;
  if (dateParam) {
    const parsed = new Date(`${dateParam}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return withCors(apiError("VALIDATION_ERROR", "date must be YYYY-MM-DD", 400));
    }
    date = parsed;
  } else {
    const now = new Date();
    date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  const t = computeDailyTimes({
    date,
    coords: { lat, lng },
    method,
    madhab,
    tz,
    highLatitudeRule,
  });

  return withCors(
    apiOk(
      {
        date: t.date.toISOString().slice(0, 10),
        coords: t.coords,
        method: t.method,
        madhab: t.madhab,
        timezone: t.tz,
        highLatitudeRule: {
          applied: t.highLatRuleApplied,
          auto: t.highLatRuleAuto,
        },
        times: {
          fajr: t.fajr.toISOString(),
          sunrise: t.sunrise.toISOString(),
          dhuhr: t.dhuhr.toISOString(),
          asr: t.asr.toISOString(),
          maghrib: t.maghrib.toISOString(),
          isha: t.isha.toISOString(),
        },
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
