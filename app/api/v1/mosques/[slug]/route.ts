import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { fetchMosqueBySlug } from "@/lib/admin/data/mosques";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await validateApiKey(req, "mosques", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const { slug } = await ctx.params;
  const { mosque } = await fetchMosqueBySlug(slug);
  if (!mosque) {
    return withCors(apiError("NOT_FOUND", `Mosque '${slug}' not found`, 404));
  }
  return withCors(
    apiOk(
      { mosque },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
