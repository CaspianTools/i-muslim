import type { MetadataRoute } from "next";
import { BUNDLED_LOCALES } from "@/i18n/config";
import {
  HADITH_COLLECTION_SLUGS,
  listPublishedHadithNumbers,
} from "@/lib/hadith/db";

// One sharded sitemap per hadith collection. Sharding by collection (not
// locale) keeps the count to 9 files; Bukhari (the largest, ~7,500 entries)
// stays well under Google's 50,000-URL hard cap. Each <url> uses the English
// locale as canonical and emits xhtml:link alternates for the other bundled
// locales.

function resolveSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "http://localhost:7777";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
const SITE_URL = resolveSiteUrl();

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

  const numbers = await listPublishedHadithNumbers(slug);
  const now = new Date();

  return numbers.map((n) => {
    const languages: Record<string, string> = {};
    for (const locale of BUNDLED_LOCALES) {
      languages[locale] = `${SITE_URL}/${locale}/hadith/${slug}/${n}`;
    }
    return {
      url: `${SITE_URL}/en/hadith/${slug}/${n}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.5,
      alternates: { languages },
    };
  });
}
