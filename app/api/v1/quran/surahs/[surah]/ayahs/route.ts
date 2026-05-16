import type { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { requireDb } from "@/lib/firebase/admin";
import { ALL_LANGS } from "@/lib/translations";

export const runtime = "nodejs";

function pickTranslations(
  raw: Record<string, string | undefined> | undefined,
  langs: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const l of langs) {
    if (l === "ar") continue;
    const v = raw[l];
    if (typeof v === "string" && v.length > 0) out[l] = v;
  }
  return out;
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ surah: string }> },
) {
  const auth = await validateApiKey(req, "quran", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const { surah: surahParam } = await ctx.params;
  const surah = Number(surahParam);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return withCors(apiError("VALIDATION_ERROR", "Invalid surah", 400));
  }

  const url = new URL(req.url);
  const translationsParam = url.searchParams.get("translations");
  const langs = translationsParam
    ? translationsParam
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ALL_LANGS.includes(s))
    : ALL_LANGS.filter((l) => l !== "ar");

  const db = requireDb();
  const snap = await db
    .collection("quran_ayahs")
    .where("surah", "==", surah)
    .where("published", "==", true)
    .get();

  const ayahs = snap.docs
    .map((d) => {
      const data = d.data() as {
        surah: number;
        ayah: number;
        text_ar: string;
        text_translit?: string | null;
        translations?: Record<string, string | undefined>;
        juz?: number;
        page?: number;
        sajdah?: boolean;
      };
      return {
        surah: data.surah,
        ayah: data.ayah,
        text_ar: data.text_ar,
        text_translit: data.text_translit ?? null,
        translations: pickTranslations(data.translations, langs),
        juz: data.juz ?? null,
        page: data.page ?? null,
        sajdah: data.sajdah ?? false,
      };
    })
    .sort((a, b) => a.ayah - b.ayah);

  return withCors(
    apiOk(
      { surah, ayahs },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}
