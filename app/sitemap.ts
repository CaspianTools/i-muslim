import type { MetadataRoute } from "next";
import { listAllPublishedSlugs } from "@/lib/blog/data";
import { fetchPublishedMosques, fetchCountryAggregates } from "@/lib/admin/data/mosques";
import { listPublishedSlugs as listPublishedBusinessSlugs } from "@/lib/businesses/public";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { SITE_URL, indexableLocales } from "@/lib/seo/metadata";

export const revalidate = 3600;

type SitemapEntry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  // localePrefix is "always", so every URL must carry a locale. The canonical
  // entry uses the default locale and lists the rest as hreflang alternates,
  // matching the per-page canonicals. Locale set = bundled + activated reserved.
  const locales = await indexableLocales();
  const entry = (
    path: string,
    extra: Omit<SitemapEntry, "url" | "alternates"> = {},
  ): SitemapEntry => {
    const languages: Record<string, string> = {};
    for (const l of locales) languages[l] = `${SITE_URL}/${l}${path}`;
    languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
    return {
      url: `${SITE_URL}/${DEFAULT_LOCALE}${path}`,
      lastModified: now,
      alternates: { languages },
      ...extra,
    };
  };

  const staticEntries: MetadataRoute.Sitemap = [
    entry("", { priority: 1.0 }),
    entry("/quran", { priority: 0.8 }),
    entry("/hadith", { priority: 0.8 }),
    entry("/articles", { priority: 0.7 }),
    entry("/mosques", { changeFrequency: "daily", priority: 0.9 }),
    entry("/businesses", { changeFrequency: "daily", priority: 0.9 }),
    entry("/about", { changeFrequency: "yearly", priority: 0.3 }),
    entry("/privacy", { changeFrequency: "yearly", priority: 0.3 }),
    entry("/terms", { changeFrequency: "yearly", priority: 0.3 }),
    entry("/contact", { changeFrequency: "yearly", priority: 0.3 }),
    entry("/downloads", { changeFrequency: "monthly", priority: 0.7 }),
    entry("/developers", { changeFrequency: "monthly", priority: 0.5 }),
  ];
  const slugs = await listAllPublishedSlugs();
  const articleEntries: MetadataRoute.Sitemap = slugs
    .filter((s) => s.locale === "en")
    .map((s) =>
      entry(`/articles/${s.slug}`, {
        lastModified: s.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    );

  const [{ mosques }, countries] = await Promise.all([
    fetchPublishedMosques({ limit: 5000 }),
    fetchCountryAggregates(),
  ]);
  const mosqueEntries: MetadataRoute.Sitemap = mosques.map((m) =>
    entry(`/mosques/${m.slug}`, {
      lastModified: m.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );
  const countryEntries: MetadataRoute.Sitemap = countries.map((c) =>
    entry(`/mosques/c/${c.countrySlug}`, {
      changeFrequency: "weekly",
      priority: 0.6,
    }),
  );
  const cityKeys = new Set<string>();
  const cityEntries: MetadataRoute.Sitemap = [];
  for (const m of mosques) {
    const key = `${m.countrySlug}/${m.citySlug}`;
    if (cityKeys.has(key)) continue;
    cityKeys.add(key);
    cityEntries.push(
      entry(`/mosques/c/${m.countrySlug}/${m.citySlug}`, {
        lastModified: m.updatedAt,
        changeFrequency: "weekly",
        priority: 0.5,
      }),
    );
  }

  const businessSlugs = await listPublishedBusinessSlugs();
  const businessEntries: MetadataRoute.Sitemap = businessSlugs.map((b) =>
    entry(`/businesses/${b.slug}`, {
      lastModified: b.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return [
    ...staticEntries,
    ...articleEntries,
    ...countryEntries,
    ...cityEntries,
    ...mosqueEntries,
    ...businessEntries,
  ];
}
