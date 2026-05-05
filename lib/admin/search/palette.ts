import "server-only";
import { fetchAllMosquesAdmin } from "@/lib/admin/data/mosques";
import { fetchArticles } from "@/lib/admin/data/articles";

export type PaletteEntityGroup = "mosques" | "articles";

export interface PaletteEntity {
  id: string;
  group: PaletteEntityGroup;
  label: string;
  hint?: string;
  href: string;
  keywords: string[];
}

export interface PaletteIndex {
  items: PaletteEntity[];
}

export async function loadPaletteIndex(): Promise<PaletteIndex> {
  const [mosqueRes, articleRes] = await Promise.all([
    fetchAllMosquesAdmin(),
    fetchArticles(),
  ]);

  const items: PaletteEntity[] = [];

  for (const m of mosqueRes.mosques) {
    const hint = [m.city, m.country].filter(Boolean).join(", ");
    items.push({
      id: m.slug,
      group: "mosques",
      label: m.name.en,
      hint: hint || undefined,
      href: `/admin/mosques/${m.slug}/edit`,
      keywords: [m.slug, m.name.ar, m.city, m.country, m.legalName].filter(
        (v): v is string => Boolean(v),
      ),
    });
  }

  for (const a of articleRes.items) {
    const tr = a.translations.en ?? Object.values(a.translations).find((t) => t);
    if (!tr) continue;
    items.push({
      id: a.id,
      group: "articles",
      label: tr.title,
      hint: tr.status,
      href: `/admin/articles/${a.id}`,
      keywords: [a.id, tr.slug, a.category].filter((v): v is string => Boolean(v)),
    });
  }

  return { items };
}
