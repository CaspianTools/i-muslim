import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { requireDb } from "@/lib/firebase/admin";
import { ALL_LANGS } from "@/lib/translations";

export const runtime = "nodejs";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

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
  const url = new URL(req.url);

  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
  );
  const startAfterRaw = url.searchParams.get("startAfter");
  const startAfter = startAfterRaw ? Number(startAfterRaw) : null;
  if (startAfter !== null && (!Number.isFinite(startAfter) || startAfter < 0)) {
    return withCors(apiError("VALIDATION_ERROR", "startAfter must be a positive integer", 400));
  }

  const translationsParam = url.searchParams.get("translations");
  const langs = translationsParam
    ? translationsParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ALL_LANGS.includes(s))
    : ALL_LANGS.filter((l) => l !== "ar");

  const db = requireDb();
  let q = db
    .collection("hadith_entries")
    .where("collection", "==", id)
    .where("published", "==", true)
    .orderBy("number", "asc")
    .limit(limit);
  if (startAfter !== null) q = q.startAfter(startAfter);

  const snap = await q.get();
  const hadiths = snap.docs.map((d) => {
    const data = d.data() as {
      collection: string;
      number: number;
      arabic_number?: number;
      book: number;
      text_ar: string;
      translations?: Record<string, string | undefined>;
      narrator?: string | null;
      grade?: string | null;
      tags?: string[];
    };
    const translations: Record<string, string> = {};
    if (data.translations) {
      for (const l of langs) {
        if (l === "ar") continue;
        const v = data.translations[l];
        if (typeof v === "string" && v.length > 0) translations[l] = v;
      }
    }
    return {
      collection: data.collection,
      number: data.number,
      arabic_number: data.arabic_number ?? null,
      book: data.book,
      text_ar: data.text_ar,
      translations,
      narrator: data.narrator ?? null,
      grade: data.grade ?? null,
      tags: data.tags ?? [],
    };
  });

  const last = hadiths[hadiths.length - 1];
  const nextCursor = hadiths.length === limit && last ? last.number : null;

  return withCors(
    apiOk(
      {
        collection: id,
        hadiths,
        pagination: { limit, nextCursor },
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
