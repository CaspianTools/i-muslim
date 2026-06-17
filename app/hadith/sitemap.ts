import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { SITE_URL, indexableLocales } from "@/lib/seo/metadata";
import {
  HADITH_COLLECTION_SLUGS,
  listPublishedHadithNumbers,
} from "@/lib/hadith/db";

// One sharded sitemap per hadith collection. Sharding by collection (not
// locale) keeps the count to 9 files; Bukhari (the largest, ~7,500 entries)
// stays well under Google's 50,000-URL hard cap. Each <url> uses the default
// locale as canonical and emits xhtml:link alternates for every indexable
// locale (bundled + activated reserved) plus x-default.

export const revalidate = 86400;

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  return HADITH_COLLECTION_SLUGS.map((_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const slug = HADITH_COLLECTION_SLUGS[id];
  if (!slug) return [];

  const [numbers, locales] = await Promise.all([
    listPublishedHadithNumbers(slug),
    indexableLocales(),
  ]);
  const now = new Date();

  return numbers.map((n) => {
    const path = `/hadith/${slug}/${n}`;
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[locale] = `${SITE_URL}/${locale}${path}`;
    }
    languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
    return {
      url: `${SITE_URL}/${DEFAULT_LOCALE}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.5,
      alternates: { languages },
    };
  });
}
