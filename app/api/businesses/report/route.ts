import { NextResponse } from "next/server";
import { reportInputSchema } from "@/lib/businesses/schemas";
import { submitBusinessReportAction } from "@/lib/admin/actions/business-reports";

export const runtime = "nodejs";

// Best-effort per-instance IP throttle for the open (unauthenticated) report
// endpoint, so it can't be used to flood the moderation queue. Per-instance
// (resets on cold start); bounded further by the backend's maxInstances cap.
const REPORTS_PER_IP_WINDOW = 8;
const REPORT_WINDOW_MS = 60 * 60_000;
const MAX_THROTTLE_ENTRIES = 5000;
const recentReports = new Map<string, { count: number; resetAt: number }>();

function overReportLimit(ip: string, now: number): boolean {
  let entry = recentReports.get(ip);
  if (!entry || now > entry.resetAt) {
    if (recentReports.size >= MAX_THROTTLE_ENTRIES) {
      for (const [k, e] of recentReports) if (now > e.resetAt) recentReports.delete(k);
    }
    entry = { count: 0, resetAt: now + REPORT_WINDOW_MS };
    recentReports.set(ip, entry);
  }
  entry.count += 1;
  return entry.count > REPORTS_PER_IP_WINDOW;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (overReportLimit(ip, Date.now())) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = reportInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const result = await submitBusinessReportAction(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.data.id });
}
