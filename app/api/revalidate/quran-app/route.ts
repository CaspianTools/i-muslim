import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { QURAN_RELEASES_TAG } from "@/lib/apps/quran-releases";

export const runtime = "nodejs";

/**
 * On-demand refresh of the /apps/quran release data (cache tag
 * `quran-app-releases`). The hourly ISR revalidate in lib/apps/quran-releases.ts
 * picks a new release up on its own; this endpoint just makes it instant — the
 * app repo (or anything else) can POST here right after a release lands:
 *
 *   curl -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     https://i-muslim.com/api/revalidate/quran-app
 *
 * Disabled (503) until REVALIDATE_SECRET is configured.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "revalidation_not_configured" },
      { status: 503 },
    );
  }

  const given = req.headers.get("x-revalidate-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  revalidateTag(QURAN_RELEASES_TAG, "max");
  return NextResponse.json({ ok: true, revalidated: QURAN_RELEASES_TAG });
}
