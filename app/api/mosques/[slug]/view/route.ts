import { NextResponse } from "next/server";
import { recordMosqueView } from "@/lib/mosques/analytics";

export const runtime = "nodejs";

// Best-effort per-instance throttle so a single client can't hammer the vanity
// view/scan counter into unbounded billable Firestore writes. The client tracker
// already fires once per session; this enforces "at most one counted view per
// (IP, slug) per window" server-side, with zero added Firestore reads. It is not
// shared across Cloud Run instances (resets on cold start) — combined with the
// backend's maxInstances cap that bounds worst-case abuse to a small multiple
// rather than the previous unbounded write rate.
const VIEW_THROTTLE_MS = 10 * 60_000;
const MAX_THROTTLE_ENTRIES = 5000;
const recentViews = new Map<string, number>();

function shouldCount(key: string, now: number): boolean {
  const last = recentViews.get(key);
  if (last !== undefined && now - last < VIEW_THROTTLE_MS) return false;
  // Opportunistic prune so the map can't grow without bound under many IPs.
  if (recentViews.size >= MAX_THROTTLE_ENTRIES) {
    for (const [k, ts] of recentViews) {
      if (now - ts >= VIEW_THROTTLE_MS) recentViews.delete(k);
    }
  }
  recentViews.set(key, now);
  return true;
}

/**
 * Records a masjid page view (and a QR scan when the visit came via the QR
 * code's `?s=qr` URL). Fired once per session by the client tracker; auth-free
 * since these are non-critical vanity counters. Throttled per IP+slug so the
 * open endpoint can't be used to inflate counters or run up write cost.
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

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!shouldCount(`${ip}:${slug}`, Date.now())) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  await recordMosqueView(slug, scan);
  return NextResponse.json({ ok: true });
}
