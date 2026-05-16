import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { getSurahs } from "@/lib/quran/db";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req, "quran", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const surahs = await getSurahs();
  return withCors(
    apiOk(
      {
        surahs: surahs.map((s) => ({
          id: s.id,
          name_arabic: s.name_arabic,
          name_simple: s.name_simple,
          name_complex: s.name_complex,
          revelation_place: s.revelation_place,
          verses_count: s.verses_count,
          bismillah_pre: s.bismillah_pre,
        })),
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
