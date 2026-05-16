import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { getHadithCollections } from "@/lib/hadith/db";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req, "hadith", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const collections = await getHadithCollections();
  return withCors(
    apiOk(
      {
        collections: collections.map((c) => ({
          slug: c.slug,
          name_en: c.name_en,
          name_ar: c.name_ar,
          short_name: c.short_name ?? null,
          total: c.total,
          books_count: c.books?.length ?? 0,
        })),
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
