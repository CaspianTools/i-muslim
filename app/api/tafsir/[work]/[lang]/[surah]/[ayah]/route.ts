import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getTafsirForAyah } from "@/lib/tafsir/db";
import { getTafsirCatalogEntry } from "@/lib/tafsir/catalog";
import { formatCoverage, resolveBlockRef } from "@/lib/tafsir/blocks";
import { getTafsirWork, workHasLang } from "@/lib/tafsir/works";

// Internal endpoint backing the reader's inline tafsir panel. Deliberately NOT
// under /api/v1 — that tree is the API-key-gated public surface, and tafsir is
// not published there in v1 (the Indonesian text is `redistribute:
// "metadata-only"`).
//
// The long s-maxage is the point: a block's text never changes between corpus
// releases, so repeat expansions are served by the CDN and never reach Cloud
// Run, let alone Firestore. /api/ is already disallowed in app/robots.ts.

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ work: string; lang: string; surah: string; ayah: string }> },
) {
  const { work: workId, lang, surah: surahRaw, ayah: ayahRaw } = await ctx.params;

  const work = getTafsirWork(workId);
  if (!work || !workHasLang(work, lang)) {
    return NextResponse.json({ error: "Unknown tafsir work or language." }, { status: 404 });
  }

  const entry = getTafsirCatalogEntry(work.id, lang);
  if (!entry?.renderOnSite) {
    return NextResponse.json({ error: "This tafsir is not available." }, { status: 404 });
  }

  const surah = Number(surahRaw);
  const ayah = Number(ayahRaw);
  if (
    !Number.isInteger(surah) ||
    surah < 1 ||
    surah > 114 ||
    !Number.isInteger(ayah) ||
    ayah < 1
  ) {
    return NextResponse.json({ error: "Invalid surah or ayah." }, { status: 400 });
  }

  // Resolve from the committed index first so a request for an ayah with no
  // coverage costs zero Firestore reads.
  const ref = resolveBlockRef(lang, surah, ayah);
  if (!ref) {
    return NextResponse.json({ error: "No tafsir for this ayah." }, { status: 404 });
  }

  const block = await getTafsirForAyah(work.id, lang, surah, ayah);
  if (!block) {
    return NextResponse.json({ error: "No tafsir for this ayah." }, { status: 404 });
  }

  return NextResponse.json(
    {
      workId: work.id,
      lang,
      blockId: block.blockId,
      slug: ref.slug,
      surah: block.surah,
      ayahKeys: block.ayahKeys,
      coverage: formatCoverage(ref),
      text: block.text,
      chars: block.chars,
      resolvedFrom: block.resolvedFrom ?? null,
      attribution: entry.attribution,
      siteNotice: entry.siteNotice ?? null,
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
