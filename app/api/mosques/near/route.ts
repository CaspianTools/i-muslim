import { NextResponse } from "next/server";
import { fetchPublishedMosques } from "@/lib/admin/data/mosques";
import { parseNearParam } from "@/lib/mosques/geo";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const near = parseNearParam(url.searchParams.get("near") ?? undefined);
  if (!near) {
    return NextResponse.json({ ok: false, error: "invalid_near" }, { status: 400 });
  }
  const limit = Number(url.searchParams.get("limit") ?? "25");
  const { mosques } = await fetchPublishedMosques({ near, limit: Math.min(100, Math.max(1, limit)) });
  return NextResponse.json({
    ok: true,
    near,
    mosques: mosques.map((m) => ({
      slug: m.slug,
      name: m.name.en,
      city: m.city,
      country: m.country,
      lat: m.location.lat,
      lng: m.location.lng,
    })),
  });
}
