import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getSiteSession } from "@/lib/auth/session";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUE_GEOCODE_CACHE_COLLECTION } from "@/lib/mosques/constants";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) | 0;
  return `g_${(h >>> 0).toString(36)}`;
}

export async function GET(req: Request) {
  const session = await getSiteSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400 });

  const cacheKey = hash(q.toLowerCase());

  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection(MOSQUE_GEOCODE_CACHE_COLLECTION).doc(cacheKey).get();
      const data = doc.data();
      if (
        data &&
        typeof data.lat === "number" &&
        typeof data.lng === "number" &&
        data.cachedAt &&
        Date.now() - (data.cachedAt as Timestamp).toMillis() < CACHE_TTL_MS
      ) {
        return NextResponse.json({ ok: true, lat: data.lat, lng: data.lng, cached: true });
      }
    } catch {
      // ignore cache errors
    }
  }

  const params = new URLSearchParams({ q, format: "json", limit: "1" });
  const userAgent = process.env.NOMINATIM_USER_AGENT ?? "i-muslim/1.0 (admin@i-muslim.app)";
  let res: Response;
  try {
    res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "network" },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `nominatim_${res.status}` }, { status: 502 });
  }
  const results = (await res.json()) as NominatimResult[];
  if (!results || results.length === 0) {
    return NextResponse.json({ ok: false, error: "no_match" }, { status: 404 });
  }
  const lat = parseFloat(results[0]!.lat);
  const lng = parseFloat(results[0]!.lon);

  if (db) {
    try {
      await db
        .collection(MOSQUE_GEOCODE_CACHE_COLLECTION)
        .doc(cacheKey)
        .set({ lat, lng, query: q, cachedAt: Timestamp.now() }, { merge: true });
    } catch {
      // ignore cache write errors
    }
  }

  return NextResponse.json({ ok: true, lat, lng, displayName: results[0]!.display_name });
}
