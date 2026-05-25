import "server-only";
import {
  QURAN_TRANSLATION_CATALOG,
  HADITH_TRANSLATION_CATALOG,
  HADITH_COLLECTION_SLUGS,
} from "@/lib/translations/catalog";
import {
  envelope,
  publicCorsPreflight,
  publicJson,
} from "@/lib/api/translations/respond";

export const runtime = "nodejs";
export const revalidate = 3600;

const HADITH_LANGS = ["ar", "en", "ru", "tr"] as const;

export async function OPTIONS() {
  return publicCorsPreflight();
}

/**
 * Index endpoint. Returns the full provenance catalogue with download URLs so
 * a consumer can discover every available translation in a single request.
 * No text — purely metadata. Safe to cache aggressively.
 */
export async function GET() {
  const quran = Object.entries(QURAN_TRANSLATION_CATALOG).map(([lang, entry]) => ({
    lang,
    ...envelope(entry),
    download_url: `/api/v1/translations/quran/${lang}`,
  }));

  const hadith: Array<Record<string, unknown>> = [];
  for (const slug of HADITH_COLLECTION_SLUGS) {
    for (const lang of HADITH_LANGS) {
      const entry = HADITH_TRANSLATION_CATALOG[`${slug}:${lang}`];
      if (!entry) continue;
      hadith.push({
        collection: slug,
        lang,
        ...envelope(entry),
        download_url: `/api/v1/translations/hadith/${slug}/${lang}`,
      });
    }
  }

  return publicJson({
    data: {
      info: {
        about:
          "Public download index for i-muslim translations. Each entry carries the upstream attribution and license. Where the upstream copyright forbids redistribution, the per-translation endpoint returns metadata only (text is null) and points you to the upstream source_url.",
        contribute_url: "/contact?subject=Translation+contribution",
      },
      quran,
      hadith,
    },
  });
}
