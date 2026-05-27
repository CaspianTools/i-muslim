import "server-only";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/firebase/admin";
import {
  IMUSLIM_AUTHORED,
  getHadithCatalogEntry,
} from "@/lib/translations/catalog";
import {
  envelope,
  gateText,
  isAuthored,
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
  editedTranslations?: Record<string, boolean>;
  published?: boolean;
  publishedTranslations?: Record<string, boolean>;
};

export async function OPTIONS() {
  return publicCorsPreflight();
}

/**
 * Full hadith collection in one language. Translation visibility per item is
 * resolved against TWO licences: i-muslim's own CC0 attribution applies when
 * `editedTranslations[lang] === true`, otherwise the upstream catalogue entry
 * (typically fawazahmed0, translator-copyrighted → metadata-only) applies.
 *
 * Arabic (`lang === "ar"`) is the classical original — single envelope, full
 * text, no authored/imported split needed.
 *
 * Non-Arabic items additionally honour `publishedTranslations[lang]` so admin
 * drafts never leak.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ collection: string; lang: string }> },
) {
  const { collection, lang } = await ctx.params;
  const upstream = getHadithCatalogEntry(collection, lang);
  if (!upstream) {
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

  const docs = snap.docs
    .map((d) => d.data() as HadithDoc)
    .filter((data) => Number.isFinite(data.number))
    .sort((a, b) => a.number - b.number);

  // Arabic short-circuit — every published item is full text from the
  // classical edition. No per-item authored/imported split is meaningful.
  if (lang === "ar") {
    const items = docs.map((data) => ({
      collection: data.collection,
      number: data.number,
      arabic_number: data.arabic_number ?? null,
      book: data.book ?? 0,
      text: gateText(upstream, data.text_ar ?? null),
    }));
    return publicJson({
      data: {
        resource: "hadith",
        collection,
        lang,
        ...envelope(upstream),
        count: items.length,
        items,
      },
    });
  }

  // Non-Arabic: per-item resolution against authored vs upstream catalogue.
  // Only items where the per-language translation has been marked Published
  // appear in the response — drafts (admin started writing but didn't
  // approve) are excluded entirely so they don't leak under either licence.
  // Per-item `source` tag then accurately reflects which licence each row
  // ships under; sources.{authored,imported}.count match items.length.
  let authoredCount = 0;
  let importedCount = 0;
  const items: Array<{
    collection: string;
    number: number;
    arabic_number: number | null;
    book: number;
    text: string | null;
    source: "authored" | "imported";
  }> = [];
  for (const data of docs) {
    if (data.publishedTranslations?.[lang] !== true) continue;
    const raw = data.translations?.[lang] ?? null;
    if (!raw) continue;
    const authored = isAuthored(data, lang);
    const entry = authored ? IMUSLIM_AUTHORED : upstream;
    if (authored) authoredCount++;
    else importedCount++;
    items.push({
      collection: data.collection,
      number: data.number,
      arabic_number: data.arabic_number ?? null,
      book: data.book ?? 0,
      text: gateText(entry, raw),
      source: authored ? "authored" : "imported",
    });
  }

  return publicJson({
    data: {
      resource: "hadith",
      collection,
      lang,
      sources: {
        authored: { ...envelope(IMUSLIM_AUTHORED), count: authoredCount },
        imported: { ...envelope(upstream), count: importedCount },
      },
      count: items.length,
      items,
    },
  });
}
