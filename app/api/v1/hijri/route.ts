import type { NextRequest } from "next/server";
import umalqura from "@umalqura/core";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";

export const runtime = "nodejs";

const MONTHS_AR = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];
const MONTHS_EN = [
  "Muharram",
  "Safar",
  "Rabi al-Awwal",
  "Rabi al-Thani",
  "Jumada al-Awwal",
  "Jumada al-Thani",
  "Rajab",
  "Shaban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qadah",
  "Dhu al-Hijjah",
];

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req, "hijri", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  let date: Date;
  if (dateParam) {
    const parsed = new Date(`${dateParam}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return withCors(apiError("VALIDATION_ERROR", "date must be YYYY-MM-DD", 400));
    }
    date = parsed;
  } else {
    date = new Date();
  }

  const h = umalqura(date);
  const monthIdx = h.hm - 1;

  return withCors(
    apiOk(
      {
        gregorian: {
          iso: date.toISOString().slice(0, 10),
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate(),
        },
        hijri: {
          year: h.hy,
          month: h.hm,
          day: h.hd,
          monthNameAr: MONTHS_AR[monthIdx] ?? "",
          monthNameEn: MONTHS_EN[monthIdx] ?? "",
        },
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
