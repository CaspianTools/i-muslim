import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { getHadithCollection } from "@/lib/hadith/db";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(req, "hadith", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const { id } = await ctx.params;
  const collection = await getHadithCollection(id);
  if (!collection) {
    return withCors(apiError("NOT_FOUND", `Hadith collection '${id}' not found`, 404));
  }
  return withCors(
    apiOk(
      { collection },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
