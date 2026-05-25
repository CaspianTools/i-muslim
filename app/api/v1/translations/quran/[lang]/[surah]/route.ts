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

/** Single-surah download for one language. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ lang: string; surah: string }> },
) {
  const { lang, surah: surahParam } = await ctx.params;
  const surah = Number(surahParam);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    return publicError(
      "VALIDATION_ERROR",
      "Surah must be an integer between 1 and 114.",
      400,
    );
  }

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
    .where("surah", "==", surah)
    .where("published", "==", true)
    .get();

  const items = snap.docs
    .map((d) => d.data() as AyahDoc)
    .filter((data) => Number.isFinite(data.ayah))
    .sort((a, b) => a.ayah - b.ayah)
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
      surah,
      ...envelope(entry),
      count: items.length,
      items,
    },
  });
}
