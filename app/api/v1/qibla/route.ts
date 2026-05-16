import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";

export const runtime = "nodejs";

const KAABA = { lat: 21.4225, lng: 39.8262 };

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}
function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

function qiblaBearing(lat: number, lng: number): number {
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA.lat);
  const dLng = toRad(KAABA.lng - lng);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req, "qibla", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return withCors(apiError("VALIDATION_ERROR", "lat and lng query params required and valid", 400));
  }

  const bearing = qiblaBearing(lat, lng);
  return withCors(
    apiOk(
      {
        origin: { lat, lng },
        kaaba: KAABA,
        bearing,
        unit: "degrees-from-north",
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
