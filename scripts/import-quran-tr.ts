/**
 * One-off import: replace the Turkish (`tr`) Quran translation in
 * `quran_ayahs` with the Diyanet İşleri Başkanlığı meal — Kur'an-ı Kerim Meâli
 * (Altuntaş & Şahin) — split to the canonical 6,236-ayah Hafs numbering.
 *
 * Source: kuran.diyanet.gov.tr (meal id `ml=1`), exported to a local JSON file
 * of shape `{ resource, lang, items: [{ surah, ayah, text }] }` (6,236 items).
 * The 746 "combined" (birleşik) ayahs were split per-ayah with AI assistance —
 * an unofficial boundary suggestion, not Diyanet's own segmentation.
 *
 * Why a dedicated script instead of `seed:quran:lang -- --lang=tr`: that seeder
 * pulls the *un-split* Diyanet text from quran.com:77. This file is now the
 * canonical TR source, so the generic seeder is guarded against `tr`
 * (see scripts/seed-quran-translation.ts).
 *
 * The source JSON is NOT committed (large + upstream-copyrighted; gitignored at
 * `scripts/data/`). Place it at the default path or pass `--file=`.
 *
 * Usage:
 *   npm run import:quran:tr -- [--file=PATH] [--dry-run] [--force]
 *
 *   --file=PATH   Source JSON (default: scripts/data/quran-tr-diyanet.json).
 *   --dry-run     Validate + report coverage, write nothing.
 *   --force       Proceed even if some file ayahs have no matching Firestore doc.
 *
 * Behaviour:
 *   - Repairs mojibake (latin1→utf8) ONLY if the file is detected double-encoded,
 *     then re-validates; aborts if any U+FFFD / residual corruption remains.
 *   - Decodes HTML entities (the Diyanet meal encodes quotes as `&quot;` etc.)
 *     so the stored text is plain UTF-8, not entity-escaped.
 *   - Validates 6,236 entries, contiguous 1..N ayahs per surah, no empty text.
 *   - Cross-checks coverage against `quran_surahs.ayah_count` and existing docs.
 *   - Overwrites `translations.tr` on ALL matched docs (replace ALL Turkish),
 *     and CLEARS any `editedTranslations.tr` flag so the public API keeps
 *     crediting Diyanet rather than i-muslim/CC0.
 *   - Recomputes `config/translationStats` at the end.
 *
 * Idempotent. Safe to re-run.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import { recomputeTranslationStats } from "./recompute-translation-stats";
import { decodeHtmlEntities } from "../lib/text/html";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const LANG = "tr";
const QURAN_COLLECTION = "quran_ayahs";
const SURAH_COLLECTION = "quran_surahs";
const DEFAULT_FILE = "scripts/data/quran-tr-diyanet.json";
const EXPECTED_COUNT = 6236;
const WRITE_BATCH = 400; // Firestore hard cap is 500 ops/batch
const READ_CHUNK = 300; // getAll fan-out per round

type Item = { surah: number; ayah: number; text: string };
type SourceFile = {
  resource?: string;
  lang?: string;
  count?: number;
  split_ayah_count?: number;
  items: Item[];
};

type Args = { file: string; dryRun: boolean; force: boolean };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let file = DEFAULT_FILE;
  for (const a of argv) {
    if (a.startsWith("--file=")) file = a.slice("--file=".length);
  }
  return {
    file,
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name} (check .env.local)`);
    process.exit(1);
  }
  return v;
}

function db(): Firestore {
  if (!getApps().length) {
    const projectId = required("FIREBASE_PROJECT_ID");
    const clientEmail = required("FIREBASE_CLIENT_EMAIL");
    const privateKey = required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore(getApp(), process.env.FIREBASE_DATABASE_ID ?? "main");
}

/**
 * Tell-tale of UTF-8 bytes mis-decoded as Latin-1/CP1252: an uppercase
 * A-tilde / A-ring / A-diaeresis (none used in Turkish) immediately followed
 * by another high-Latin1 byte. Deliberately omits "Â" (U+00C2) because that IS
 * a legitimate Turkish letter (e.g. "Âlemlerin"), so it would false-positive.
 */
const MOJIBAKE_RE = /[ÃÄÅ][-¿]/;

function repairMojibake(s: string): string {
  return Buffer.from(s, "latin1").toString("utf8");
}

/** Canonical Hafs ayah count per surah (index 0 = surah 1). */
const CANON_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54,
  45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62,
  55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28,
  20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15,
  21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

function loadAndValidate(file: string): Item[] {
  const path = resolve(process.cwd(), file);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(
      `Cannot read source file: ${path}\n` +
        `Place the Diyanet ml=1 ayah-split JSON there, or pass --file=PATH.`,
    );
    process.exit(1);
  }

  let parsed: SourceFile;
  try {
    parsed = JSON.parse(raw) as SourceFile;
  } catch (e) {
    console.error(`Source file is not valid JSON: ${(e as Error).message}`);
    process.exit(1);
  }

  if (parsed.lang && parsed.lang !== LANG) {
    console.error(`Source file lang="${parsed.lang}", expected "${LANG}".`);
    process.exit(1);
  }
  if (!Array.isArray(parsed.items)) {
    console.error(`Source file has no "items" array.`);
    process.exit(1);
  }

  const items = parsed.items;

  // --- shape check ---
  const malformed = items.filter(
    (it) =>
      typeof it?.surah !== "number" ||
      typeof it?.ayah !== "number" ||
      typeof it?.text !== "string",
  );
  if (malformed.length) {
    console.error(
      `${malformed.length} malformed item(s), e.g. ${JSON.stringify(malformed[0])}`,
    );
    process.exit(1);
  }

  // --- encoding repair (only if clearly needed) ---
  const corruptCount = items.filter((it) => MOJIBAKE_RE.test(it.text)).length;
  if (corruptCount > items.length * 0.1) {
    console.warn(
      `[encoding] ${corruptCount} item(s) look double-encoded — repairing latin1→utf8`,
    );
    for (const it of items) it.text = repairMojibake(it.text);
  } else if (corruptCount > 0) {
    console.warn(
      `[encoding] ${corruptCount} item(s) matched the mojibake heuristic but that is below the repair threshold — leaving text untouched (inspect manually if Turkish looks wrong).`,
    );
  }

  // --- HTML entity decode (the Diyanet meal encodes quotes as &quot; etc.) ---
  let entityCount = 0;
  for (const it of items) {
    const decoded = decodeHtmlEntities(it.text);
    if (decoded !== it.text) {
      it.text = decoded;
      entityCount++;
    }
  }
  if (entityCount) {
    console.warn(`[entities] decoded HTML entities in ${entityCount} item(s).`);
  }

  // --- post-repair text sanity ---
  const bad = items.filter(
    (it) =>
      it.text.trim().length === 0 ||
      /�/.test(it.text) ||
      MOJIBAKE_RE.test(it.text),
  );
  if (bad.length) {
    console.error(
      `${bad.length} item(s) have empty / replacement-char / still-corrupt text after validation. ` +
        `First: ${JSON.stringify(bad[0])}. Aborting — supply a clean UTF-8 source.`,
    );
    process.exit(1);
  }

  // --- coverage check against canonical Hafs structure ---
  const seen = new Map<number, Set<number>>();
  for (const it of items) {
    if (!seen.has(it.surah)) seen.set(it.surah, new Set());
    const set = seen.get(it.surah)!;
    if (set.has(it.ayah)) {
      console.error(`Duplicate ayah in source: ${it.surah}:${it.ayah}`);
      process.exit(1);
    }
    set.add(it.ayah);
  }
  const problems: string[] = [];
  for (let s = 1; s <= 114; s++) {
    const expected = CANON_AYAH_COUNTS[s - 1];
    const set = seen.get(s) ?? new Set<number>();
    if (set.size !== expected) {
      problems.push(`surah ${s}: ${set.size} ayahs (canon ${expected})`);
    }
    for (let a = 1; a <= expected; a++) {
      if (!set.has(a)) problems.push(`missing ${s}:${a}`);
    }
    for (const a of set) {
      if (a < 1 || a > expected) problems.push(`out-of-range ${s}:${a}`);
    }
  }
  if (problems.length) {
    console.error(
      `Source does not match canonical Hafs structure (${problems.length} problem(s)):\n  ` +
        problems.slice(0, 25).join("\n  "),
    );
    process.exit(1);
  }
  if (items.length !== EXPECTED_COUNT) {
    console.error(
      `Expected ${EXPECTED_COUNT} items, got ${items.length}. Aborting.`,
    );
    process.exit(1);
  }

  console.log(
    `[source] ${items.length} ayahs validated (114 surahs, canonical Hafs coverage, clean UTF-8).`,
  );
  return items;
}

async function crossCheckSurahCounts(
  firestore: Firestore,
  items: Item[],
): Promise<void> {
  const snap = await firestore.collection(SURAH_COLLECTION).get();
  if (snap.empty) {
    console.warn(
      `[coverage] ${SURAH_COLLECTION} is empty — skipping surah-count cross-check (run \`npm run seed:quran\` first?).`,
    );
    return;
  }
  const dbCounts = new Map<number, number>();
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.number === "number" && typeof data.ayah_count === "number") {
      dbCounts.set(data.number, data.ayah_count);
    }
  }
  const fileCounts = new Map<number, number>();
  for (const it of items) {
    fileCounts.set(it.surah, (fileCounts.get(it.surah) ?? 0) + 1);
  }
  const mismatches: string[] = [];
  for (const [s, n] of fileCounts) {
    const dbN = dbCounts.get(s);
    if (dbN != null && dbN !== n) {
      mismatches.push(`surah ${s}: file=${n} db=${dbN}`);
    }
  }
  if (mismatches.length) {
    console.warn(
      `[coverage] ${mismatches.length} surah(s) where the file count differs from quran_surahs.ayah_count:\n  ` +
        mismatches.slice(0, 25).join("\n  "),
    );
  } else {
    console.log(`[coverage] surah counts agree with quran_surahs.`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const items = loadAndValidate(args.file);

  const firestore = db();
  console.log(
    `Connecting to Firestore project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );
  console.log(
    `Importing Quran TR (Diyanet ml=1, ayah-split) → ${QURAN_COLLECTION}.translations.${LANG}` +
      (args.dryRun ? "  [DRY RUN — no writes]" : ""),
  );

  await crossCheckSurahCounts(firestore, items);

  const col = firestore.collection(QURAN_COLLECTION);
  items.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);

  type Op = { id: string; text: string; clearFlag: boolean };
  const ops: Op[] = [];
  const missing: string[] = [];
  let unpublished = 0;
  let flaggedAuthored = 0;

  // Single read pass: confirm each doc exists, note publish/authored state,
  // and stage the write payload. Commit only after coverage is validated.
  for (let i = 0; i < items.length; i += READ_CHUNK) {
    const slice = items.slice(i, i + READ_CHUNK);
    const refs = slice.map((it) => col.doc(`${it.surah}:${it.ayah}`));
    const snaps = await firestore.getAll(...refs);
    for (let j = 0; j < slice.length; j++) {
      const it = slice[j];
      const snap = snaps[j];
      const id = `${it.surah}:${it.ayah}`;
      if (!snap.exists) {
        missing.push(id);
        continue;
      }
      const data = snap.data() ?? {};
      if (data.published !== true) unpublished++;
      const hadFlag =
        (data.editedTranslations as Record<string, boolean> | undefined)?.[
          LANG
        ] === true;
      if (hadFlag) flaggedAuthored++;
      ops.push({ id, text: it.text, clearFlag: hadFlag });
    }
  }

  console.log(
    `[coverage] matched ${ops.length}/${items.length} docs` +
      (missing.length ? `, ${missing.length} MISSING` : "") +
      (unpublished ? `, ${unpublished} unpublished (text still written)` : "") +
      (flaggedAuthored
        ? `, ${flaggedAuthored} had editedTranslations.${LANG}=true (will be cleared so attribution stays Diyanet)`
        : ""),
  );
  if (missing.length) {
    console.warn(
      `[coverage] missing doc ids (first 25): ${missing.slice(0, 25).join(", ")}`,
    );
    if (!args.force) {
      console.error(
        `Aborting: ${missing.length} ayah(s) have no Firestore doc. ` +
          `Run \`npm run seed:quran\` first, or pass --force to skip them.`,
      );
      process.exit(1);
    }
    console.warn(`[coverage] --force set — skipping the ${missing.length} missing doc(s).`);
  }

  if (args.dryRun) {
    console.log(
      `[dry-run] would write ${ops.length} translations.${LANG} ` +
        `(${flaggedAuthored} flag clears). No changes made.`,
    );
    process.exit(0);
  }

  let written = 0;
  let pending = firestore.batch();
  let pendingCount = 0;
  for (const op of ops) {
    const payload: Record<string, unknown> = {
      translations: { [LANG]: op.text },
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "import:diyanet-tr",
    };
    // Overwriting upstream-sourced text: drop any per-lang authored flag so the
    // public API resolves this back to the Diyanet catalogue entry, not CC0.
    if (op.clearFlag) {
      payload.editedTranslations = { [LANG]: FieldValue.delete() };
    }
    pending.set(col.doc(op.id), payload, { merge: true });
    pendingCount++;
    written++;
    if (pendingCount >= WRITE_BATCH) {
      await pending.commit();
      pending = firestore.batch();
      pendingCount = 0;
    }
  }
  if (pendingCount > 0) await pending.commit();

  console.log(
    `Done. Wrote ${written} translations.${LANG}` +
      (flaggedAuthored ? `, cleared ${flaggedAuthored} authored flag(s).` : "."),
  );

  await recomputeTranslationStats(firestore);

  console.log(
    `\nNote: the public reader caches surah reads for 1 day (unstable_cache). ` +
      `New text appears within 24h, or sooner on redeploy. The admin Quran ` +
      `editor (no-cache reads) shows it immediately.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
