/**
 * Seed Firestore with one language of one tafsir work.
 *
 * Usage:
 *   npm run seed:tafsir -- --lang=ar --dry-run
 *   npm run seed:tafsir -- --lang=ar
 *   npm run seed:tafsir -- --lang=id --only-surah=2
 *   npm run seed:tafsir -- --lang=ar --verify
 *
 * Source data is the Ibn Kathir corpus JSONL, which is NOT committed — see
 * `.gitignore` (`scripts/data/`). Place it at scripts/data/ibn-kathir/ or pass
 * --corpus-dir. Only `ar` and `id` may be ingested: the English set is the
 * in-copyright Darussalam abridgement and the Russian set's provenance is
 * unverified, so the script refuses both by name rather than trusting the
 * operator to remember.
 *
 * Writes three things:
 *   tafsir_blocks/{work}:{lang}:{blockId}      one document per block
 *   tafsir_surah_index/{work}:{lang}:{surah}   block summaries + excerpts, so
 *                                              the listing page costs ONE read
 *   tafsir_works/{work}                        corpus version + per-lang stats
 *
 * Idempotent and content-addressed: a block whose text hash and corpus version
 * both match is skipped without a write, so a patch release costs exactly as
 * many writes as there were corrections. Admin-edited blocks are preserved; if
 * upstream also changed under an admin edit, the block is flagged
 * `upstreamDrift` instead of being silently overwritten or silently masked.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { config as loadEnv } from "dotenv";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { decodeHtmlEntities } from "../lib/text/html";
import { tafsirExcerpt } from "../lib/tafsir/render";
import { blockSlug } from "../lib/tafsir/blocks";
import { TAFSIR_WORKS, type TafsirLang } from "../lib/tafsir/works";
import { getTafsirCatalogEntry } from "../lib/tafsir/catalog";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const WRITE_BATCH = 400; // Firestore caps a batch at 500; leave headroom.
const READ_CHUNK = 300; // getAll() chunk, matching scripts/import-quran-tr.ts.
const MAX_DOC_BYTES = 800_000; // Hard fail well under Firestore's 1 MiB limit.
const WARN_DOC_BYTES = 400_000;

/** Languages this script will touch. See the header for why en/ru are refused. */
const ALLOWED_LANGS: readonly TafsirLang[] = ["ar", "id"];
const REFUSED = {
  en: "English is the Darussalam abridgement and is in copyright (MANIFEST: 'IN COPYRIGHT'). Not ingestable.",
  ru: "Russian provenance is unverified (MANIFEST: 'Reference only. Verify provenance before any use.'). Not ingestable.",
} as const;

type SourceBlock = {
  block_id: string;
  lang: string;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  ayah_keys: string[];
  ayah_count: number;
  text: string;
  chars: number;
  words: number;
  type?: string;
  pointer_target?: string;
  editor_notes?: string[];
  note_count?: number;
};

/**
 * The exact field set written to Firestore. Asserted per document, so an
 * accidental spread of the source record — which would carry `editor_notes`,
 * the Dar Taybah editors' copyrighted apparatus — fails loudly instead of
 * silently publishing it.
 */
const EXPECTED_KEYS = [
  "ayahCount",
  "ayahEnd",
  "ayahKeys",
  "ayahStart",
  "blockId",
  "chars",
  "corpusVersion",
  "kind",
  "lang",
  "pointerTarget",
  "published",
  "schemaVersion",
  "slug",
  "sourceId",
  "surah",
  "text",
  "textSha256",
  "words",
  "workId",
].sort();

type Args = {
  work: string;
  lang: TafsirLang;
  corpusDir: string;
  corpusVersion: string;
  dryRun: boolean;
  verify: boolean;
  onlySurah: number | null;
  force: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string): string | null => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    if (eq) return eq.slice(name.length + 3);
    const i = argv.indexOf(`--${name}`);
    if (i !== -1 && argv[i + 1] && !argv[i + 1]!.startsWith("--")) return argv[i + 1]!;
    return null;
  };

  const lang = (get("lang") ?? "").toLowerCase();
  if (!lang) {
    console.error("Missing --lang=<ar|id>");
    process.exit(1);
  }
  if (lang in REFUSED) {
    console.error(`Refusing --lang=${lang}. ${REFUSED[lang as keyof typeof REFUSED]}`);
    process.exit(1);
  }
  if (!ALLOWED_LANGS.includes(lang as TafsirLang)) {
    console.error(`Unknown --lang=${lang}. Valid: ${ALLOWED_LANGS.join(", ")}`);
    process.exit(1);
  }

  const work = get("work") ?? "ibn-kathir";
  if (!TAFSIR_WORKS.some((w) => w.id === work)) {
    console.error(`Unknown --work=${work}. Add it to lib/tafsir/works.ts first.`);
    process.exit(1);
  }

  const onlySurahRaw = get("only-surah");
  const onlySurah = onlySurahRaw == null ? null : Number(onlySurahRaw);
  if (onlySurah != null && (!Number.isInteger(onlySurah) || onlySurah < 1 || onlySurah > 114)) {
    console.error("--only-surah must be an integer 1..114");
    process.exit(1);
  }

  return {
    work,
    lang: lang as TafsirLang,
    corpusDir: get("corpus-dir") ?? join("scripts", "data", work),
    corpusVersion: get("corpus-version") ?? "1.0.0",
    dryRun: argv.includes("--dry-run"),
    verify: argv.includes("--verify"),
    onlySurah,
    force: argv.includes("--force"),
  };
}

function db(): Firestore {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local",
    );
    process.exit(1);
  }
  const app = getApps().length
    ? getApp()
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return getFirestore(app, process.env.FIREBASE_DATABASE_ID ?? "main");
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

type Prepared = {
  docId: string;
  surah: number;
  payload: Record<string, unknown>;
  excerpt: string;
  slug: string;
};

function prepare(raw: SourceBlock, args: Args, sourceId: string): Prepared {
  const { work, lang, corpusVersion } = args;

  // Structural assertions. Each held across all 7,162 blocks at build time;
  // they exist so a future corpus revision cannot quietly break routing.
  const expectedId = `${pad3(raw.surah)}-${pad3(raw.ayah_start)}`;
  if (raw.block_id !== expectedId) {
    throw new Error(`block_id ${raw.block_id} != derived ${expectedId}`);
  }
  if (raw.ayah_keys.length !== raw.ayah_count) {
    throw new Error(`${raw.block_id}: ayah_keys ${raw.ayah_keys.length} != ayah_count ${raw.ayah_count}`);
  }
  for (const key of raw.ayah_keys) {
    if (Number(key.split(":")[0]) !== raw.surah) {
      throw new Error(`${raw.block_id}: ayah key ${key} outside surah ${raw.surah}`);
    }
  }

  const kind = raw.type === "pointer" ? "pointer" : "content";
  // Only the Indonesian set carries HTML entities (7 blocks). stripHtml is
  // deliberately NOT used — its tag regex over 12.2M chars is wasted work and
  // could eat a legitimate "<" — and cleanQuranTranslation is not used either,
  // since its English footnote-digit stripper would corrupt prose.
  const text = decodeHtmlEntities(raw.text).trim();
  if (kind === "content" && text.length === 0) {
    throw new Error(`${raw.block_id}: empty text on a content block`);
  }

  const ayahEnd = raw.ayah_keys.length
    ? Math.max(...raw.ayah_keys.map((k) => Number(k.split(":")[1])))
    : raw.ayah_end;

  const payload: Record<string, unknown> = {
    schemaVersion: 1,
    workId: work,
    lang,
    blockId: raw.block_id,
    slug: blockSlug(raw.ayah_start, ayahEnd),
    surah: raw.surah,
    ayahStart: raw.ayah_start,
    ayahEnd,
    ayahKeys: raw.ayah_keys,
    ayahCount: raw.ayah_count,
    kind,
    pointerTarget: raw.pointer_target ?? null,
    text,
    chars: text.length,
    words: raw.words,
    corpusVersion,
    textSha256: sha256(text),
    sourceId,
    published: true,
  };

  // The editor_notes leak guard. An omission is invisible in review; a failed
  // assertion is not.
  const keys = Object.keys(payload).sort();
  if (JSON.stringify(keys) !== JSON.stringify(EXPECTED_KEYS)) {
    throw new Error(
      `${raw.block_id}: field set drift.\n  got:      ${keys.join(",")}\n  expected: ${EXPECTED_KEYS.join(",")}`,
    );
  }

  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (bytes > MAX_DOC_BYTES) {
    throw new Error(`${raw.block_id}: ${bytes} bytes exceeds the ${MAX_DOC_BYTES} cap`);
  }

  return {
    docId: `${work}:${lang}:${raw.block_id}`,
    surah: raw.surah,
    payload,
    excerpt: tafsirExcerpt(text, 240),
    slug: payload.slug as string,
  };
}

async function* readBlocks(file: string): AsyncGenerator<SourceBlock> {
  // Streamed, not readFileSync: the Arabic JSONL is 25 MB and the Indonesian
  // 17 MB. Streaming keeps RSS flat and stops anyone copying a
  // readFileSync+JSON.parse shape into a runtime module later.
  const rl = createInterface({
    input: createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed) yield JSON.parse(trimmed) as SourceBlock;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const { work, lang } = args;

  const catalogEntry = getTafsirCatalogEntry(work, lang);
  if (!catalogEntry) {
    console.error(
      `No licensing entry for ${work}:${lang} in lib/tafsir/catalog.ts. Add one before ingesting.`,
    );
    process.exit(1);
  }

  const blocksFile = join(args.corpusDir, `${lang}.blocks.jsonl`);
  if (!existsSync(blocksFile)) {
    console.error(`Corpus not found: ${blocksFile}\nPass --corpus-dir=<path> or copy it in.`);
    process.exit(1);
  }

  const manifestPath = join(args.corpusDir, "MANIFEST.json");
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>)
    : null;
  const manifestLang = (manifest?.languages as Record<string, Record<string, unknown>> | undefined)?.[lang];
  const expectedBlocks = manifestLang?.blocks as number | undefined;

  console.log(
    `Tafsir ingest — work=${work} lang=${lang} version=${args.corpusVersion}` +
      `${args.dryRun ? " [DRY RUN]" : ""}${args.verify ? " [VERIFY]" : ""}`,
  );
  console.log(`  source:  ${blocksFile}`);
  console.log(`  licence: ${catalogEntry.license} (redistribute: ${catalogEntry.redistribute})`);
  if (expectedBlocks) console.log(`  manifest expects ${expectedBlocks} blocks`);

  const store = args.dryRun ? null : db();
  if (store) {
    console.log(
      `  firestore: project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
    );
  }

  // ---- pass 1: read, validate, prepare -----------------------------------
  const prepared: Prepared[] = [];
  const ayahSeen = new Map<string, string>();
  const kindCount = { content: 0, pointer: 0 };
  let maxBytes = 0;
  let maxBytesId = "";
  let overWarn = 0;

  for await (const raw of readBlocks(blocksFile)) {
    if (args.onlySurah != null && raw.surah !== args.onlySurah) continue;
    const p = prepare(raw, args, catalogEntry.sourceId);
    kindCount[(p.payload.kind as "content" | "pointer")]++;

    for (const key of raw.ayah_keys) {
      const prior = ayahSeen.get(key);
      if (prior) throw new Error(`ayah ${key} claimed by both ${prior} and ${raw.block_id}`);
      ayahSeen.set(key, raw.block_id);
    }

    const bytes = Buffer.byteLength(JSON.stringify(p.payload), "utf8");
    if (bytes > maxBytes) {
      maxBytes = bytes;
      maxBytesId = raw.block_id;
    }
    if (bytes > WARN_DOC_BYTES) overWarn++;

    prepared.push(p);
  }

  console.log(
    `\n  blocks ${prepared.length}` +
      (expectedBlocks && args.onlySurah == null ? `/${expectedBlocks}` : "") +
      ` · content=${kindCount.content} pointer=${kindCount.pointer}`,
  );
  console.log(
    `  ayahKeys ${ayahSeen.size} unique, 0 duplicates · maxDocBytes ${maxBytes} (${maxBytesId}) · >${WARN_DOC_BYTES}B: ${overWarn}`,
  );

  if (args.onlySurah == null) {
    if (expectedBlocks && prepared.length !== expectedBlocks) {
      throw new Error(`block count ${prepared.length} != manifest ${expectedBlocks}`);
    }
    if (ayahSeen.size !== 6236) {
      throw new Error(`ayah coverage ${ayahSeen.size} != 6236`);
    }
  }

  if (args.dryRun) {
    console.log("\nDry run — nothing written.");
    return;
  }
  const firestore = store as Firestore;

  // ---- verify mode: read back, compare, assert no leakage ----------------
  if (args.verify) {
    let match = 0;
    let missing = 0;
    let mismatch = 0;
    let leaked = 0;
    for (let i = 0; i < prepared.length; i += READ_CHUNK) {
      const chunk = prepared.slice(i, i + READ_CHUNK);
      const snaps = await firestore.getAll(
        ...chunk.map((p) => firestore.collection("tafsir_blocks").doc(p.docId)),
      );
      snaps.forEach((snap, j) => {
        const want = chunk[j] as Prepared;
        if (!snap.exists) {
          missing++;
          return;
        }
        const data = snap.data() ?? {};
        if ("editorNotes" in data || "editor_notes" in data || "noteCount" in data) leaked++;
        if (data.textSha256 === want.payload.textSha256) match++;
        else mismatch++;
      });
    }
    console.log(
      `\nVerify: ${match} match · ${mismatch} differ (admin edits) · ${missing} missing · ${leaked} with editor notes`,
    );
    if (missing > 0 || leaked > 0) process.exitCode = 1;
    return;
  }

  // ---- pass 2: diff against Firestore, write only what changed -----------
  let written = 0;
  let unchanged = 0;
  let preserved = 0;
  let drift = 0;

  const col = firestore.collection("tafsir_blocks");
  let batch = firestore.batch();
  let pending = 0;

  for (let i = 0; i < prepared.length; i += READ_CHUNK) {
    const chunk = prepared.slice(i, i + READ_CHUNK);
    const snaps = await firestore.getAll(...chunk.map((p) => col.doc(p.docId)));

    for (let j = 0; j < chunk.length; j++) {
      const p = chunk[j] as Prepared;
      const snap = snaps[j];
      const existing = snap?.exists ? (snap.data() ?? {}) : null;

      if (existing) {
        const sameText = existing.textSha256 === p.payload.textSha256;
        const sameVersion = existing.corpusVersion === args.corpusVersion;
        if (existing.editedByAdmin === true && !args.force) {
          if (sameText) {
            preserved++;
            continue;
          }
          // Upstream moved under an admin edit. Don't overwrite the edit, but
          // don't lose the fact either — flag it for the admin queue.
          batch.set(
            col.doc(p.docId),
            {
              upstreamSha256: p.payload.textSha256,
              upstreamDrift: true,
              upstreamVersion: args.corpusVersion,
            },
            { merge: true },
          );
          pending++;
          drift++;
          preserved++;
          continue;
        }
        if (sameText && sameVersion) {
          unchanged++;
          continue;
        }
      }

      batch.set(
        col.doc(p.docId),
        {
          ...p.payload,
          upstreamSha256: p.payload.textSha256,
          upstreamDrift: false,
          editedByAdmin: false,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: `seed:tafsir:${args.corpusVersion}`,
        },
        { merge: true },
      );
      pending++;
      written++;

      if (pending >= WRITE_BATCH) {
        await batch.commit();
        batch = firestore.batch();
        pending = 0;
      }
    }
  }
  if (pending > 0) await batch.commit();

  // ---- per-surah summary docs (one read per listing page, not N) ---------
  const bySurah = new Map<number, Prepared[]>();
  for (const p of prepared) {
    const list = bySurah.get(p.surah);
    if (list) list.push(p);
    else bySurah.set(p.surah, [p]);
  }

  let indexBatch = firestore.batch();
  let indexPending = 0;
  const indexCol = firestore.collection("tafsir_surah_index");
  for (const [surah, list] of [...bySurah].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => (a.payload.ayahStart as number) - (b.payload.ayahStart as number));
    indexBatch.set(indexCol.doc(`${work}:${lang}:${surah}`), {
      workId: work,
      lang,
      surah,
      corpusVersion: args.corpusVersion,
      blocks: list.map((p) => ({
        blockId: p.payload.blockId,
        slug: p.slug,
        ayahStart: p.payload.ayahStart,
        ayahEnd: p.payload.ayahEnd,
        ayahKeys: p.payload.ayahKeys,
        chars: p.payload.chars,
        excerpt: p.excerpt,
      })),
      updatedAt: FieldValue.serverTimestamp(),
    });
    indexPending++;
    if (indexPending >= WRITE_BATCH) {
      await indexBatch.commit();
      indexBatch = firestore.batch();
      indexPending = 0;
    }
  }
  if (indexPending > 0) await indexBatch.commit();

  // ---- work meta ---------------------------------------------------------
  if (args.onlySurah == null) {
    const totalChars = prepared.reduce((n, p) => n + (p.payload.chars as number), 0);
    await firestore
      .collection("tafsir_works")
      .doc(work)
      .set(
        {
          workId: work,
          corpusVersion: args.corpusVersion,
          corpusBuilt: (manifest?.built as string) ?? null,
          langs: {
            [lang]: {
              blocks: prepared.length,
              chars: totalChars,
              ayahKeys: ayahSeen.size,
              edition: catalogEntry.edition,
              ingestedAt: new Date().toISOString(),
            },
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { mergeFields: ["workId", "corpusVersion", "corpusBuilt", `langs.${lang}`, "updatedAt"] },
      );
  }

  console.log(
    `\nDone. written=${written} unchanged=${unchanged} preserved=${preserved} drift=${drift}` +
      ` · surah index docs=${bySurah.size}`,
  );
  if (drift > 0) {
    console.log(
      `  ${drift} admin-edited block(s) diverged from upstream — review them in /admin.`,
    );
  }
}

main().catch((err) => {
  console.error("\nIngest failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
