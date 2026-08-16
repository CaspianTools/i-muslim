import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { revalidateTafsirSurah, revalidateTafsirWork } from "@/lib/tafsir/db";
import { getTafsirWork, workHasLang } from "@/lib/tafsir/works";

// Drops the cached tafsir for a work, or for specific surahs of one language.
//
// `scripts/seed-tafsir.ts` runs outside the Next runtime and so cannot call
// `revalidateTag` itself. Without this endpoint a corpus correction waits out
// the 24-hour TTL — and, more sharply, a block browsed *before* it was seeded
// caches its `null` for a full day, so the page 404s long after the data lands.
// Mirrors POST /api/revalidate/quran-app, including answering 503 while
// REVALIDATE_SECRET is unset (it is commented out in apphosting.yaml).

export const runtime = "nodejs";

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "REVALIDATE_SECRET is not configured." },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-revalidate-secret") ?? "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { work?: string; lang?: string; surahs?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const work = getTafsirWork(body.work ?? "ibn-kathir");
  if (!work) {
    return NextResponse.json({ error: "Unknown tafsir work." }, { status: 400 });
  }

  const lang = body.lang;
  const surahs = Array.isArray(body.surahs)
    ? body.surahs.filter(
        (n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 114,
      )
    : [];

  // No language or no surah list → blow away the whole work. That is the right
  // default after a full re-ingest, and it is cheap: these are cache tags.
  if (!lang || !workHasLang(work, lang) || surahs.length === 0) {
    revalidateTafsirWork(work.id);
    return NextResponse.json({ revalidated: "work", work: work.id });
  }

  for (const surah of surahs) revalidateTafsirSurah(work.id, lang, surah);
  return NextResponse.json({
    revalidated: "surahs",
    work: work.id,
    lang,
    surahs,
  });
}
