import "server-only";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/firebase/admin";
import { getQuranCatalogEntry } from "@/lib/translations/catalog";
import {
  envelope,
  gateText,
  publicCorsPreflight,
  publicError,
  publicJson,
} from "@/lib/api/translations/respond";

export const runtime = "nodejs";
export const revalidate = 3600;

type AyahDoc = {
  surah: number;
  ayah: number;
  text_ar?: string;
  translations?: Record<string, string | undefined>;
  published?: boolean;
};

export async function OPTIONS() {
  return publicCorsPreflight();
}

/**
 * Full-Quran download for one language. ~6,236 ayahs in one payload; gzip
 * makes it small enough that streaming is overkill at this scale. CDN cache
 * (s-maxage in shared headers) absorbs the cost of the Firestore reads — only
 * the first request per cache window pays.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ lang: string }> },
) {
  const { lang } = await ctx.params;
  const entry = getQuranCatalogEntry(lang);
  if (!entry) {
    return publicError(
      "NOT_FOUND",
      `No Quran translation registered for language "${lang}".`,
      404,
    );
  }

  const db = getDb();
  if (!db) {
    return publicError("UNAVAILABLE", "Translation data store is offline.", 503);
  }

  const snap = await db
    .collection("quran_ayahs")
    .where("published", "==", true)
    .get();

  const items = snap.docs
    .map((d) => d.data() as AyahDoc)
    .filter((data) => Number.isFinite(data.surah) && Number.isFinite(data.ayah))
    .sort((a, b) =>
      a.surah !== b.surah ? a.surah - b.surah : a.ayah - b.ayah,
    )
    .map((data) => {
      const raw = lang === "ar" ? data.text_ar ?? null : data.translations?.[lang] ?? null;
      return {
        surah: data.surah,
        ayah: data.ayah,
        text: gateText(entry, raw),
      };
    });

  return publicJson({
    data: {
      resource: "quran",
      lang,
      ...envelope(entry),
      count: items.length,
      items,
    },
  });
}
