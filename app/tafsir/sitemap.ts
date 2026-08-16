import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { SITE_URL, indexableLocales } from "@/lib/seo/metadata";
import { allBlockRefs } from "@/lib/tafsir/blocks";
import { TAFSIR_WORKS, type TafsirLang } from "@/lib/tafsir/works";
import { getTafsirCatalogEntry } from "@/lib/tafsir/catalog";

// One sharded sitemap per (work, language). Ibn Kathir gives two shards today:
// Arabic at 1,911 block URLs and Indonesian at 5,251 — both far under Google's
// 50,000-URL cap, and small enough that neither file is expensive to build on a
// 512 MiB instance.
//
// Everything here comes from the COMMITTED index in lib/tafsir/blocks.ts. That
// is not a preference: FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY are
// `availability: [RUNTIME]` in apphosting.yaml, so `generateSitemaps` — which
// runs at build — has no database. A Firestore call here fails the App Hosting
// build, and push to main is a production deploy.

export const revalidate = 86400;

type Shard = { workId: string; lang: TafsirLang };

/** Renderable (work, lang) pairs, in a stable order so shard ids never move. */
function shards(): Shard[] {
  const out: Shard[] = [];
  for (const work of TAFSIR_WORKS) {
    for (const lang of work.langs) {
      if (getTafsirCatalogEntry(work.id, lang)?.renderOnSite !== true) continue;
      out.push({ workId: work.id, lang });
    }
  }
  return out;
}

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
  return shards().map((_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  // Next 16 changed this: the id from generateSitemaps arrives as a PROMISE
  // resolving to a STRING, not a number (see the v16.0.0 row in
  // node_modules/next/dist/docs/.../generate-sitemaps.md). Destructuring it as a
  // number yields "[object Promise]" and every shard silently renders empty.
  const index = Number.parseInt(await props.id, 10);
  const shard = Number.isInteger(index) ? shards()[index] : undefined;
  if (!shard) return [];

  const locales = await indexableLocales();
  const now = new Date();

  const entry = (
    path: string,
    priority: number,
  ): MetadataRoute.Sitemap[number] => {
    const languages: Record<string, string> = {};
    for (const locale of locales) languages[locale] = `${SITE_URL}/${locale}${path}`;
    languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
    return {
      url: `${SITE_URL}/${DEFAULT_LOCALE}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority,
      alternates: { languages },
    };
  };

  const { workId, lang } = shard;
  const out: MetadataRoute.Sitemap = [entry(`/tafsir/${workId}/${lang}`, 0.6)];

  const seenSurahs = new Set<number>();
  for (const ref of allBlockRefs(lang)) {
    if (!seenSurahs.has(ref.surah)) {
      seenSurahs.add(ref.surah);
      out.push(entry(`/tafsir/${workId}/${lang}/${ref.surah}`, 0.5));
    }
    out.push(entry(`/tafsir/${workId}/${lang}/${ref.surah}/${ref.slug}`, 0.5));
  }

  return out;
}
