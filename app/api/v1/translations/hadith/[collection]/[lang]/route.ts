import "server-only";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/firebase/admin";
import { getHadithCatalogEntry } from "@/lib/translations/catalog";
import {
  envelope,
  gateText,
  publicCorsPreflight,
  publicError,
  publicJson,
} from "@/lib/api/translations/respond";

export const runtime = "nodejs";
export const revalidate = 3600;

type HadithDoc = {
  collection: string;
  number: number;
  arabic_number?: number;
  book?: number;
  text_ar?: string;
  translations?: Record<string, string | undefined>;
  published?: boolean;
  publishedTranslations?: Record<string, boolean>;
};

export async function OPTIONS() {
  return publicCorsPreflight();
}

/**
 * Full hadith collection in one language. Translation visibility honours the
 * admin `publishedTranslations.<lang>` per-doc flag for non-Arabic langs;
 * Arabic is the original sacred text and is gated only by the doc-level
 * `published` flag.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ collection: string; lang: string }> },
) {
  const { collection, lang } = await ctx.params;
  const entry = getHadithCatalogEntry(collection, lang);
  if (!entry) {
    return publicError(
      "NOT_FOUND",
      `No Hadith translation registered for collection "${collection}" lang "${lang}".`,
      404,
    );
  }

  const db = getDb();
  if (!db) {
    return publicError("UNAVAILABLE", "Translation data store is offline.", 503);
  }

  const snap = await db
    .collection("hadith_entries")
    .where("collection", "==", collection)
    .where("published", "==", true)
    .get();

  const items = snap.docs
    .map((d) => d.data() as HadithDoc)
    .filter((data) => Number.isFinite(data.number))
    .sort((a, b) => a.number - b.number)
    .map((data) => {
      let raw: string | null;
      if (lang === "ar") {
        raw = data.text_ar ?? null;
      } else {
        const isPublished = data.publishedTranslations?.[lang] === true;
        raw = isPublished ? data.translations?.[lang] ?? null : null;
      }
      return {
        collection: data.collection,
        number: data.number,
        arabic_number: data.arabic_number ?? null,
        book: data.book ?? 0,
        text: gateText(entry, raw),
      };
    });

  return publicJson({
    data: {
      resource: "hadith",
      collection,
      lang,
      ...envelope(entry),
      count: items.length,
      items,
    },
  });
}
