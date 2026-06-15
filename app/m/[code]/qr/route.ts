import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { fetchMosqueByShortCode } from "@/lib/admin/data/mosques";
import { getSiteUrl } from "@/lib/mosques/constants";
import { canManageMosque } from "@/lib/mosques/authz";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { mosque } = await fetchMosqueByShortCode(code);
  if (!mosque) return new NextResponse("Not found", { status: 404 });
  // Drafts are only generatable by the manager; published codes are public.
  if (mosque.status !== "published" && !(await canManageMosque(mosque.slug))) {
    return new NextResponse("Not found", { status: 404 });
  }

  // `?s=qr` lets the page's view tracker count QR scans separately from visits.
  const url = `${getSiteUrl()}/m/${code}?s=qr`;
  const format = new URL(req.url).searchParams.get("format") === "svg" ? "svg" : "png";

  if (format === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2 });
    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "content-disposition": `attachment; filename="${mosque.slug}-qr.svg"`,
        "cache-control": "public, max-age=86400",
      },
    });
  }

  const buf = await QRCode.toBuffer(url, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "image/png",
      "content-disposition": `attachment; filename="${mosque.slug}-qr.png"`,
      "cache-control": "public, max-age=86400",
    },
  });
}
