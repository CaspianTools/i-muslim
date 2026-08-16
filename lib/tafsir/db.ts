import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { cache } from "react";
import { getDb } from "@/lib/firebase/admin";
import {
  adjacentBlockRefs,
  getBlockRef,
  resolveBlockRef,
  type BlockRef,
} from "./blocks";
import type { TafsirLang } from "./works";

// Firestore layer for tafsir blocks. Deliberately shaped so no code path can
// load more than one block's `text` per request:
//
//   * every text read is a `.doc(id).get()` on a deterministic id — no queries,
//     no composite index (see the `text` indexing exemption in
//     firestore.indexes.json, which is required: an indexed string that large
//     fails to write)
//   * block enumeration, coverage and prev/next come from the COMMITTED index
//     in lib/tafsir/blocks.ts, at zero read cost
//   * the surah listing reads ONE summary document, not one per block
//
// Al-Baqarah's Arabic commentary is 3.2 MB across 178 blocks. Rendering a whole
// surah at concurrency 80 would be ~1 GB against a 512 MiB Cloud Run limit, so
// "at most one block of text per request" is a hard contract, not a guideline.

export const TAFSIR_BLOCKS_COLLECTION = "tafsir_blocks";
export const TAFSIR_SURAH_INDEX_COLLECTION = "tafsir_surah_index";
export const TAFSIR_WORKS_COLLECTION = "tafsir_works";

const REVALIDATE_SECONDS = 60 * 60 * 24; // 1 day, matching lib/quran/db.ts

const surahTag = (work: string, lang: string, surah: number) =>
  `tafsir:${work}:${lang}:${surah}`;
const workTag = (work: string) => `tafsir:work:${work}`;

export function tafsirBlockDocId(
  work: string,
  lang: TafsirLang,
  blockId: string,
): string {
  return `${work}:${lang}:${blockId}`;
}

export type TafsirBlock = {
  workId: string;
  lang: TafsirLang;
  blockId: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  /** Exact ayahs covered — may be non-contiguous. Drives the display label. */
  ayahKeys: string[];
  kind: "content" | "pointer";
  text: string;
  chars: number;
  corpusVersion: string;
  editedByAdmin: boolean;
  /** Set when this block was reached by following a pointer stub. */
  resolvedFrom?: { blockId: string; viaAyahKey: string };
};

export type TafsirBlockSummary = {
  blockId: string;
  slug: string;
  ayahStart: number;
  ayahEnd: number;
  ayahKeys: string[];
  chars: number;
  excerpt: string;
};

type BlockDoc = {
  workId: string;
  lang: TafsirLang;
  blockId: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  ayahKeys: string[];
  kind: "content" | "pointer";
  text: string;
  chars: number;
  corpusVersion: string;
  editedByAdmin?: boolean;
  published?: boolean;
};

function toBlock(data: BlockDoc): TafsirBlock {
  return {
    workId: data.workId,
    lang: data.lang,
    blockId: data.blockId,
    surah: data.surah,
    ayahStart: data.ayahStart,
    ayahEnd: data.ayahEnd,
    ayahKeys: Array.isArray(data.ayahKeys) ? data.ayahKeys : [],
    kind: data.kind === "pointer" ? "pointer" : "content",
    text: typeof data.text === "string" ? data.text : "",
    chars: typeof data.chars === "number" ? data.chars : 0,
    corpusVersion: data.corpusVersion ?? "",
    editedByAdmin: data.editedByAdmin === true,
  };
}

async function readBlock(
  work: string,
  lang: TafsirLang,
  blockId: string,
): Promise<TafsirBlock | null> {
  const db = getDb();
  if (!db) {
    console.error("[tafsir] Firestore not configured — no block for", blockId);
    return null;
  }
  const snap = await db
    .collection(TAFSIR_BLOCKS_COLLECTION)
    .doc(tafsirBlockDocId(work, lang, blockId))
    .get();
  if (!snap.exists) return null;
  const data = snap.data() as BlockDoc;
  if (data.published === false) return null;
  return toBlock(data);
}

/**
 * One block by id. Cached per block, tagged per surah — an admin edit to one
 * block invalidates that surah and nothing else. Same nested `unstable_cache`
 * shape as `getAyahsForSurah` in lib/quran/db.ts, which is how a per-entity
 * cache key and a coarser invalidation tag coexist.
 */
export const getTafsirBlockRaw = cache(
  async (
    work: string,
    lang: TafsirLang,
    blockId: string,
  ): Promise<TafsirBlock | null> => {
    const surah = Number(blockId.slice(0, 3));
    return unstable_cache(
      () => readBlock(work, lang, blockId),
      [`tafsir:block:${work}:${lang}:${blockId}`],
      {
        revalidate: REVALIDATE_SECONDS,
        tags: [surahTag(work, lang, surah), workTag(work)],
      },
    )();
  },
);

async function resolvePointer(
  work: string,
  lang: TafsirLang,
  stub: TafsirBlock,
): Promise<TafsirBlock | null> {
  const ref = getBlockRef(lang, stub.blockId);
  if (!ref) return null;
  const { prev, next } = adjacentBlockRefs(lang, ref);
  // Try the neighbour the stub points at first, then the other one, so a
  // missing or malformed pointerTarget still lands on real commentary.
  const candidates = [next, prev].filter(Boolean) as BlockRef[];
  for (const candidate of candidates) {
    const resolved = await getTafsirBlockRaw(work, lang, candidate.blockId);
    if (resolved && resolved.kind === "content") return resolved;
  }
  return null;
}

/**
 * One block, following a pointer stub through to the block that actually
 * carries the commentary. 39 Indonesian blocks are stubs whose entire text is a
 * cross-reference ("Lihat tafsir ayat selanjutnya"); rendering those raw would
 * ship "see the next ayah" as commentary.
 *
 * Depth is capped at one hop — verified sufficient for all 39 — so a malformed
 * future corpus degrades to showing the stub rather than looping.
 */
export async function getTafsirBlock(
  work: string,
  lang: TafsirLang,
  blockId: string,
): Promise<TafsirBlock | null> {
  const block = await getTafsirBlockRaw(work, lang, blockId);
  if (!block || block.kind !== "pointer") return block;

  const target = await resolvePointer(work, lang, block);
  if (!target) return block;
  return {
    ...target,
    resolvedFrom: {
      blockId: block.blockId,
      viaAyahKey: block.ayahKeys[0] ?? `${block.surah}:${block.ayahStart}`,
    },
  };
}

/** The block covering an ayah, resolved through the committed index. */
export async function getTafsirForAyah(
  work: string,
  lang: TafsirLang,
  surah: number,
  ayah: number,
): Promise<TafsirBlock | null> {
  const ref = resolveBlockRef(lang, surah, ayah);
  if (!ref) return null;
  return getTafsirBlock(work, lang, ref.blockId);
}

/**
 * Block summaries for a surah's listing page — ONE document read, not one per
 * block. Written by scripts/seed-tafsir.ts alongside the blocks. Returns an
 * empty array if the summary doc is missing so the page can fall back to the
 * committed index (without excerpts) rather than failing.
 */
export const getSurahBlockSummaries = cache(
  async (
    work: string,
    lang: TafsirLang,
    surah: number,
  ): Promise<TafsirBlockSummary[]> =>
    unstable_cache(
      async () => {
        const db = getDb();
        if (!db) return [];
        const snap = await db
          .collection(TAFSIR_SURAH_INDEX_COLLECTION)
          .doc(`${work}:${lang}:${surah}`)
          .get();
        if (!snap.exists) return [];
        const blocks = snap.data()?.blocks;
        return Array.isArray(blocks) ? (blocks as TafsirBlockSummary[]) : [];
      },
      [`tafsir:surah-index:${work}:${lang}:${surah}`],
      {
        revalidate: REVALIDATE_SECONDS,
        tags: [surahTag(work, lang, surah), workTag(work)],
      },
    )(),
);

export type TafsirWorkMeta = {
  workId: string;
  corpusVersion: string;
  corpusBuilt: string;
  langs: Record<
    string,
    { blocks: number; chars: number; edition: string; ayahKeys: number }
  >;
};

export const getTafsirWorkMeta = cache(
  async (work: string): Promise<TafsirWorkMeta | null> =>
    unstable_cache(
      async () => {
        const db = getDb();
        if (!db) return null;
        const snap = await db.collection(TAFSIR_WORKS_COLLECTION).doc(work).get();
        if (!snap.exists) return null;
        return snap.data() as TafsirWorkMeta;
      },
      [`tafsir:meta:${work}`],
      { revalidate: REVALIDATE_SECONDS, tags: [workTag(work)] },
    )(),
);

/** Call after any admin write to a block. Mirrors `revalidateSurah`. */
export function revalidateTafsirSurah(
  work: string,
  lang: TafsirLang,
  surah: number,
): void {
  revalidateTag(surahTag(work, lang, surah), { expire: 0 });
}

/** Call after a corpus re-ingest. */
export function revalidateTafsirWork(work: string): void {
  revalidateTag(workTag(work), { expire: 0 });
}
