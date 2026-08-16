// Ayah → tafsir-block resolution, driven entirely by the committed indexes in
// lib/tafsir/index/<lang>.json. No Firestore, no network, no async.
//
// Why the index is committed rather than read from Firestore:
//   1. App Hosting exposes FIREBASE_* only at RUNTIME (see apphosting.yaml), so
//      the sitemap and any generateStaticParams cannot touch Firestore at all.
//   2. Resolving "which block covers 2:255" on every reader render would cost a
//      query per ayah. In memory it costs nothing.
// Each file is ~111 KB — the same order as messages/ar.json (205 KB).
//
// NOTE: this module must never be imported from a "use client" component, or
// both indexes ship to the browser. Server components resolve the ref and pass
// the plain object down as a prop.

import arIndex from "./index/ar.json";
import idIndex from "./index/id.json";
import type { TafsirLang } from "./works";

/** A block's identity and the exact ayahs it covers. Derived, never stored. */
export type BlockRef = {
  blockId: string;
  surah: number;
  /**
   * URL segment: "255" for a single ayah, "1-5" for a span. Verified unique
   * per (lang, surah) across all 7,162 blocks in the corpus — block starts are
   * unique by construction, so two blocks can never produce the same slug. The
   * ingest re-asserts this so a future edition can't silently break routing.
   */
  slug: string;
  /** The block's first ayah. */
  ayahStart: number;
  /** The block's last ayah — max(ayahs), which may skip gaps. */
  ayahEnd: number;
  /**
   * Every ayah this block covers. Usually contiguous, but 35 Indonesian blocks
   * cover scattered ayahs (e.g. 002-052 covers 2:52, 2:53, 2:82, 2:162), so a
   * [start, end] range would over-claim. Always trust this array.
   */
  ayahs: number[];
};

const RAW: Record<TafsirLang, Record<string, string>> = {
  ar: arIndex as Record<string, string>,
  id: idIndex as Record<string, string>,
};

type LangTables = {
  byAyahKey: Map<string, string>;
  byBlockId: Map<string, BlockRef>;
  /** `${surah}/${slug}` → BlockRef, for direct URL resolution. */
  bySlug: Map<string, BlockRef>;
  bySurah: Map<number, BlockRef[]>;
};

const CACHE = new Map<TafsirLang, LangTables>();

export function blockSlug(ayahStart: number, ayahEnd: number): string {
  return ayahStart === ayahEnd ? String(ayahStart) : `${ayahStart}-${ayahEnd}`;
}

/**
 * Build the reverse tables for one language on first use. Lazy per language so
 * an Arabic-only request never parses the Indonesian map.
 */
function tables(lang: TafsirLang): LangTables {
  const cached = CACHE.get(lang);
  if (cached) return cached;

  const raw = RAW[lang];
  const byAyahKey = new Map<string, string>();
  const grouped = new Map<string, number[]>();

  for (const [ayahKey, blockId] of Object.entries(raw)) {
    byAyahKey.set(ayahKey, blockId);
    const ayah = Number(ayahKey.slice(ayahKey.indexOf(":") + 1));
    const list = grouped.get(blockId);
    if (list) list.push(ayah);
    else grouped.set(blockId, [ayah]);
  }

  const byBlockId = new Map<string, BlockRef>();
  const bySlug = new Map<string, BlockRef>();
  const bySurah = new Map<number, BlockRef[]>();

  for (const [blockId, ayahs] of grouped) {
    ayahs.sort((a, b) => a - b);
    // block_id is always `{surah:03d}-{ayahStart:03d}` — verified across all
    // 7,162 blocks in both languages, so it parses rather than needing a lookup.
    const surah = Number(blockId.slice(0, 3));
    const ayahStart = Number(blockId.slice(4));
    const ayahEnd = ayahs[ayahs.length - 1] ?? ayahStart;
    const ref: BlockRef = {
      blockId,
      surah,
      slug: blockSlug(ayahStart, ayahEnd),
      ayahStart,
      ayahEnd,
      ayahs,
    };
    byBlockId.set(blockId, ref);
    bySlug.set(`${surah}/${ref.slug}`, ref);
    const forSurah = bySurah.get(surah);
    if (forSurah) forSurah.push(ref);
    else bySurah.set(surah, [ref]);
  }

  for (const refs of bySurah.values()) refs.sort((a, b) => a.ayahStart - b.ayahStart);

  const built: LangTables = { byAyahKey, byBlockId, bySlug, bySurah };
  CACHE.set(lang, built);
  return built;
}

/** The block covering a given ayah, or null if the language has no entry. */
export function resolveBlockRef(
  lang: TafsirLang,
  surah: number,
  ayah: number,
): BlockRef | null {
  const t = tables(lang);
  const blockId = t.byAyahKey.get(`${surah}:${ayah}`);
  if (!blockId) return null;
  return t.byBlockId.get(blockId) ?? null;
}

export function getBlockRef(lang: TafsirLang, blockId: string): BlockRef | null {
  return tables(lang).byBlockId.get(blockId) ?? null;
}

/** Exact slug lookup — the fast path when the URL is already canonical. */
export function getBlockRefBySlug(
  lang: TafsirLang,
  surah: number,
  slug: string,
): BlockRef | null {
  return tables(lang).bySlug.get(`${surah}/${slug}`) ?? null;
}

/** Every block in a surah, ordered. Empty array for an unknown surah. */
export function listBlockRefs(lang: TafsirLang, surah: number): BlockRef[] {
  return tables(lang).bySurah.get(surah) ?? [];
}

/** Every block in the corpus, ordered by surah then ayah. Used by the sitemap. */
export function allBlockRefs(lang: TafsirLang): BlockRef[] {
  const t = tables(lang);
  const out: BlockRef[] = [];
  for (let surah = 1; surah <= 114; surah++) {
    const refs = t.bySurah.get(surah);
    if (refs) out.push(...refs);
  }
  return out;
}

export function countBlocks(lang: TafsirLang, surah?: number): number {
  const t = tables(lang);
  if (surah != null) return t.bySurah.get(surah)?.length ?? 0;
  return t.byBlockId.size;
}

/** Block counts per surah, for the surah-index pages. Zero Firestore reads. */
export function blocksPerSurah(lang: TafsirLang): Record<number, number> {
  const t = tables(lang);
  const out: Record<number, number> = {};
  for (const [surah, refs] of t.bySurah) out[surah] = refs.length;
  return out;
}

/** Previous/next block in reading order, crossing surah boundaries. */
export function adjacentBlockRefs(
  lang: TafsirLang,
  ref: BlockRef,
): { prev: BlockRef | null; next: BlockRef | null } {
  const t = tables(lang);
  const within = t.bySurah.get(ref.surah) ?? [];
  const i = within.findIndex((r) => r.blockId === ref.blockId);
  if (i === -1) return { prev: null, next: null };

  let prev = within[i - 1] ?? null;
  if (!prev) {
    for (let s = ref.surah - 1; s >= 1 && !prev; s--) {
      const list = t.bySurah.get(s);
      if (list?.length) prev = list[list.length - 1] ?? null;
    }
  }
  let next = within[i + 1] ?? null;
  if (!next) {
    for (let s = ref.surah + 1; s <= 114 && !next; s++) {
      const list = t.bySurah.get(s);
      if (list?.length) next = list[0] ?? null;
    }
  }
  return { prev, next };
}

/**
 * Human-readable coverage label, e.g. "1" / "155–162" / "52–53, 82, 162".
 * Runs collapse; gaps are shown, so a block never silently claims ayahs it
 * doesn't cover. Surah number is not included — callers pair it with the name.
 */
export function formatCoverage(ref: BlockRef): string {
  const first = ref.ayahs[0];
  if (first === undefined) return String(ref.ayahStart);

  const parts: string[] = [];
  let runStart = first;
  let prev = first;
  const flush = (end: number) => {
    parts.push(runStart === end ? `${runStart}` : `${runStart}–${end}`);
  };

  for (let i = 1; i < ref.ayahs.length; i++) {
    const n = ref.ayahs[i] as number;
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    flush(prev);
    runStart = n;
    prev = n;
  }
  flush(prev);
  return parts.join(", ");
}
