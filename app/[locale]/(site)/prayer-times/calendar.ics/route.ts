import type { NextRequest } from "next/server";
import {
  ALL_METHODS,
} from "@/lib/prayer/methods";
import {
  computeDailyTimes,
  type MadhabKey,
  type MethodKey,
  type PrayerKey,
} from "@/lib/prayer/engine";

const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIcsUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  const method = (url.searchParams.get("method") ?? "MuslimWorldLeague") as MethodKey;
  const madhabRaw = url.searchParams.get("madhab") ?? "shafi";
  const madhab: MadhabKey = madhabRaw === "hanafi" ? "hanafi" : "shafi";
  const tz = url.searchParams.get("tz") || "UTC";
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 1),
    90,
  );
  const city = url.searchParams.get("city") ?? "";

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return new Response("Missing or invalid lat/lng", { status: 400 });
  }
  if (!ALL_METHODS.includes(method)) {
    return new Response("Invalid method", { status: 400 });
  }

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//i-muslim//Prayer Times//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`Prayer Times${city ? ` — ${city}` : ""}`)}`,
    `X-WR-TIMEZONE:${escapeIcs(tz)}`,
  ];

  const stamp = toIcsUtc(new Date());

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const times = computeDailyTimes({
      date: d,
      coords: { lat, lng },
      method,
      madhab,
      tz,
    });
    for (const key of ["fajr", "dhuhr", "asr", "maghrib", "isha"] as PrayerKey[]) {
      const at = times[key];
      const end = new Date(at.getTime() + 15 * 60 * 1000);
      const dayKey = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`;
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:imuslim-${dayKey}-${key}@i-muslim`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART:${toIcsUtc(at)}`);
      lines.push(`DTEND:${toIcsUtc(end)}`);
      lines.push(
        `SUMMARY:${escapeIcs(PRAYER_LABELS[key])}${city ? escapeIcs(` — ${city}`) : ""}`,
      );
      lines.push(
        `DESCRIPTION:${escapeIcs(`${PRAYER_LABELS[key]} — ${method}, ${madhab === "hanafi" ? "Hanafi" : "Standard"}`)}`,
      );
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n");
  const filename = `prayer-times${city ? `-${city.toLowerCase().replace(/\s+/g, "-")}` : ""}.ics`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
