import "server-only";
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Shared auth + revalidation for the /api/revalidate/<app> routes.
 *
 * The hourly ISR revalidate in lib/apps/releases.ts picks a new release up on
 * its own; these endpoints just make it instant, so an app repo can POST right
 * after a release lands:
 *
 *   curl -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" \
 *     https://i-muslim.com/api/revalidate/<app>
 *
 * Disabled (503) until REVALIDATE_SECRET is configured. The comparison is
 * constant-time, so a wrong secret leaks nothing about the right one.
 */
export async function handleRevalidate(req: Request, tag: string) {
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

  revalidateTag(tag, "max");
  return NextResponse.json({ ok: true, revalidated: tag });
}
