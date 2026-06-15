import { NextResponse } from "next/server";
import { recordMosqueView } from "@/lib/mosques/analytics";

export const runtime = "nodejs";

/**
 * Records a masjid page view (and a QR scan when the visit came via the QR
 * code's `?s=qr` URL). Fired once per session by the client tracker; auth-free
 * since these are non-critical vanity counters.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  let scan = false;
  try {
    const body = (await req.json()) as { scan?: boolean };
    scan = Boolean(body?.scan);
  } catch {
    // empty/invalid body — treat as a plain view
  }
  await recordMosqueView(slug, scan);
  return NextResponse.json({ ok: true });
}
