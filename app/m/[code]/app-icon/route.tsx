import { ImageResponse } from "next/og";
import { fetchMosqueByShortCode } from "@/lib/admin/data/mosques";

export const runtime = "nodejs";

/**
 * Per-masjid app icon, generated at the size the web manifest asks for so the
 * "install" criteria (a real 192px + 512px icon) are met regardless of the
 * dimensions of the manager-uploaded logo. Falls back to the masjid's initial
 * on the brand green when no logo is set.
 *
 * (Named `app-icon` rather than `icon` because `icon` is a reserved Next.js
 * metadata route name.)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { mosque } = await fetchMosqueByShortCode(code);
  if (!mosque) return new Response("Not found", { status: 404 });

  const requested = Number(new URL(req.url).searchParams.get("size"));
  const size = requested >= 512 ? 512 : 192;
  const logo = mosque.logoUrl;
  const initial = (mosque.name.en?.trim()?.[0] ?? "M").toUpperCase();

  return new ImageResponse(
    logo ? (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fafaf9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    ) : (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#7ba143",
          color: "white",
          fontSize: Math.round(size * 0.5),
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {initial}
      </div>
    ),
    { width: size, height: size },
  );
}
