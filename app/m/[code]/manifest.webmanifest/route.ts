import { NextResponse } from "next/server";
import { fetchMosqueByShortCode } from "@/lib/admin/data/mosques";

export const runtime = "nodejs";

/**
 * Per-masjid web app manifest so a follower can install the masjid's page as its
 * own standalone app (its name + logo as the icon, launching straight into
 * `/m/<code>`). The bare page links this via its `metadata.manifest`, overriding
 * the site-wide manifest for this route only.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { mosque } = await fetchMosqueByShortCode(code);
  if (!mosque || mosque.status !== "published") {
    return new NextResponse("Not found", { status: 404 });
  }

  const name = mosque.name.en;
  const base = `/m/${code}`;
  const manifest = {
    name,
    short_name: name.length > 12 ? `${name.slice(0, 11)}…` : name,
    description: mosque.about?.slice(0, 200) ?? `${name} — prayer times, news, and events.`,
    id: base,
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#7ba143",
    icons: [
      { src: `${base}/app-icon?size=192`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/app-icon?size=512`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/app-icon?size=512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=3600",
    },
  });
}
