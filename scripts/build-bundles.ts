/**
 * Build per-(resource, lang) SQLite content bundles for the native mobile
 * app (`i-muslim-mobile`). Reads Firestore, writes .db files (FTS5-enabled),
 * computes sha256 + size, optionally uploads to Firebase Storage, and
 * updates the manifest doc at `config/bundles` that `/api/v1/bundles/manifest`
 * serves to the mobile app.
 *
 * Run:
 *   npm run build:bundles -- --bundle quran.ar
 *   npm run build:bundles -- --all
 *   npm run build:bundles -- --all --upload          # also push to Storage
 *   npm run build:bundles -- --all --dry-run         # don't touch Firestore
 *
 * v1 scope: **only `redistribute: "full"` bundles are built** — Arabic Quran
 * mushaf (public domain) and Arabic Hadith per collection (classical public
 * domain). Translation bundles are deliberately not built in v1 because
 * every modern translation in our catalogue is under translator-held
 * copyright (see lib/translations/catalog.ts) — shipping their text inside
 * an .ipa/.apk would be infringement. When the project has CC0-authored
 * translations to redistribute, extend HADITH_TRANSLATION_TARGETS below to
 * filter on `editedTranslations[lang] === true` and skip the rest.
 *
 * Output: `scripts/bundles-output/<id>.v<n>.db`. Run with --upload to push
 * to Firebase Storage at `gs://<project>.appspot.com/bundles/<id>.v<n>.db`.
 *
 * Requires Node 22+ (uses the built-in `node:sqlite` module — no native
 * dependency, no MSVC build tools needed on Windows). FTS5 is compiled into
 * Node's bundled SQLite.
 */

import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import {
  HADITH_COLLECTION_SLUGS,
  QURAN_TRANSLATION_CATALOG,
  HADITH_TRANSLATION_CATALOG,
} from "@/lib/translations/catalog";

/* --------------------------------------------------------------------- */
/* Bootstrap                                                              */
/* --------------------------------------------------------------------- */

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
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
  return getFirestore(getApp(), process.env.FIREBASE_DATABASE_ID ?? "main");
}

/* --------------------------------------------------------------------- */
/* Schemas (mirror i-muslim-mobile/src/content/sqlite-schema.ts)          */
/* --------------------------------------------------------------------- */

const QURAN_AR_SCHEMA = `
  CREATE TABLE surahs (
    number INTEGER PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    revelation_place TEXT NOT NULL CHECK (revelation_place IN ('makkah','madinah')),
    ayah_count INTEGER NOT NULL,
    bismillah_pre INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE ayahs (
    surah INTEGER NOT NULL,
    ayah INTEGER NOT NULL,
    text_ar TEXT NOT NULL,
    juz INTEGER,
    page INTEGER,
    sajdah INTEGER DEFAULT 0,
    PRIMARY KEY (surah, ayah)
  );
  CREATE VIRTUAL TABLE ayahs_fts USING fts5(
    text_ar,
    content='ayahs',
    tokenize='unicode61'
  );
`;

const HADITH_AR_SCHEMA = `
  CREATE TABLE hadith_collection (
    slug TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    total INTEGER NOT NULL
  );
  CREATE TABLE hadith_books (
    book_number INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    count INTEGER NOT NULL
  );
  CREATE TABLE hadith_ar (
    number INTEGER PRIMARY KEY,
    book INTEGER NOT NULL,
    text_ar TEXT NOT NULL,
    grade TEXT,
    arabic_number INTEGER
  );
  CREATE VIRTUAL TABLE hadith_ar_fts USING fts5(
    text_ar,
    content='hadith_ar',
    tokenize='unicode61'
  );
`;

/* --------------------------------------------------------------------- */
/* Targets                                                                 */
/* --------------------------------------------------------------------- */

interface BundleTarget {
  id: string;
  resource: "quran" | "hadith";
  lang: string;
  collection?: string;
  label: Record<string, string>;
  requires: string[];
  bundledWithApp: boolean;
  version: number;
  license: string;
  attribution: string;
  redistribute: "full" | "metadata-only";
  build: (db: Firestore, outPath: string) => Promise<void>;
}

const QURAN_AR_TARGET: BundleTarget = {
  id: "quran.ar",
  resource: "quran",
  lang: "ar",
  label: { en: "Arabic Quran (Uthmani Mushaf)", ar: "القرآن الكريم (المصحف العثماني)" },
  requires: [],
  bundledWithApp: true,
  version: 1,
  license: QURAN_TRANSLATION_CATALOG.ar?.license ?? "Public Domain",
  attribution:
    QURAN_TRANSLATION_CATALOG.ar?.attribution ?? "Uthmani Mushaf (classical text)",
  redistribute: QURAN_TRANSLATION_CATALOG.ar?.redistribute ?? "full",
  build: buildQuranAr,
};

const HADITH_AR_TARGETS: BundleTarget[] = HADITH_COLLECTION_SLUGS.map((slug) => {
  const cat = HADITH_TRANSLATION_CATALOG[`${slug}:ar`];
  return {
    id: `hadith.${slug}.ar`,
    resource: "hadith" as const,
    lang: "ar",
    collection: slug,
    label: {
      en: `${slug} (Arabic)`,
      ar: `${slug} (العربية)`,
    },
    requires: [],
    bundledWithApp: false,
    version: 1,
    license: cat?.license ?? "Public Domain",
    attribution: cat?.attribution ?? "Classical Arabic edition (public domain)",
    redistribute: cat?.redistribute ?? "full",
    build: (db: Firestore, outPath: string) => buildHadithAr(db, slug, outPath),
  };
});

const ALL_TARGETS: BundleTarget[] = [QURAN_AR_TARGET, ...HADITH_AR_TARGETS];

/* --------------------------------------------------------------------- */
/* Builders                                                               */
/* --------------------------------------------------------------------- */

async function buildQuranAr(fs: Firestore, outPath: string): Promise<void> {
  console.log(`  reading quran_surahs ...`);
  const surahsSnap = await fs.collection("quran_surahs").get();
  console.log(`  reading quran_ayahs ...`);
  const ayahsSnap = await fs.collection("quran_ayahs").get();

  // Recreate from scratch so re-runs don't pile rows.
  try {
    rmSync(outPath, { force: true });
  } catch {
    /* ignore */
  }

  const sqlite = new DatabaseSync(outPath);
  sqlite.exec(QURAN_AR_SCHEMA);

  const insertSurah = sqlite.prepare(`
    INSERT INTO surahs(number, name_ar, name_en, revelation_place, ayah_count, bismillah_pre)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAyah = sqlite.prepare(`
    INSERT INTO ayahs(surah, ayah, text_ar, juz, page, sajdah)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  sqlite.exec("BEGIN");
  try {
    for (const doc of surahsSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const number = numberOr(d.number, NaN);
      if (!Number.isFinite(number)) continue;
      insertSurah.run(
        number,
        String(d.name_ar ?? ""),
        String(d.name_en ?? ""),
        d.revelation_place === "madinah" ? "madinah" : "makkah",
        numberOr(d.ayah_count, 0),
        d.bismillah_pre === false ? 0 : 1,
      );
    }
    for (const doc of ayahsSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const surah = numberOr(d.surah, NaN);
      const ayah = numberOr(d.ayah, NaN);
      if (!Number.isFinite(surah) || !Number.isFinite(ayah)) continue;
      if (typeof d.text_ar !== "string" || d.text_ar.length === 0) continue;
      insertAyah.run(
        surah,
        ayah,
        d.text_ar,
        numberOrNull(d.juz),
        numberOrNull(d.page),
        d.sajdah === true ? 1 : 0,
      );
    }
    sqlite.exec(`INSERT INTO ayahs_fts(rowid, text_ar) SELECT rowid, text_ar FROM ayahs`);
    sqlite.exec("COMMIT");
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
  sqlite.close();
  console.log(`  wrote ${surahsSnap.size} surahs + ${ayahsSnap.size} ayahs`);
}

async function buildHadithAr(
  fs: Firestore,
  slug: string,
  outPath: string,
): Promise<void> {
  console.log(`  reading hadith_collections/${slug} ...`);
  const collDoc = await fs.collection("hadith_collections").doc(slug).get();
  if (!collDoc.exists) {
    throw new Error(`hadith_collections/${slug} not found`);
  }
  const coll = collDoc.data() as Record<string, unknown>;

  console.log(`  reading hadith_entries (collection=${slug}, published=true) ...`);
  const entriesSnap = await fs
    .collection("hadith_entries")
    .where("collection", "==", slug)
    .where("published", "==", true)
    .get();

  try {
    rmSync(outPath, { force: true });
  } catch {
    /* ignore */
  }

  const sqlite = new DatabaseSync(outPath);
  sqlite.exec(HADITH_AR_SCHEMA);

  const insertCollection = sqlite.prepare(`
    INSERT INTO hadith_collection(slug, name_ar, name_en, total) VALUES (?, ?, ?, ?)
  `);
  const insertBook = sqlite.prepare(`
    INSERT INTO hadith_books(book_number, name, count) VALUES (?, ?, ?)
  `);
  const insertHadith = sqlite.prepare(`
    INSERT INTO hadith_ar(number, book, text_ar, grade, arabic_number) VALUES (?, ?, ?, ?, ?)
  `);

  sqlite.exec("BEGIN");
  try {
    insertCollection.run(
      slug,
      String(coll.name_ar ?? ""),
      String(coll.name_en ?? slug),
      numberOr(coll.total, entriesSnap.size),
    );
    const books = Array.isArray(coll.books) ? (coll.books as unknown[]) : [];
    for (const raw of books) {
      if (!raw || typeof raw !== "object") continue;
      const b = raw as Record<string, unknown>;
      const num = numberOr(b.number, NaN);
      if (!Number.isFinite(num)) continue;
      insertBook.run(num, String(b.name ?? `Book ${num}`), numberOr(b.count, 0));
    }
    for (const doc of entriesSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const number = numberOr(d.number, NaN);
      const book = numberOr(d.book, 0);
      if (!Number.isFinite(number)) continue;
      if (typeof d.text_ar !== "string" || d.text_ar.length === 0) continue;
      insertHadith.run(
        number,
        book,
        d.text_ar,
        typeof d.grade === "string" ? d.grade : null,
        numberOrNull(d.arabic_number),
      );
    }
    sqlite.exec(
      `INSERT INTO hadith_ar_fts(rowid, text_ar) SELECT rowid, text_ar FROM hadith_ar`,
    );
    sqlite.exec("COMMIT");
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
  sqlite.close();
  console.log(`  wrote ${entriesSnap.size} hadith`);
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/* --------------------------------------------------------------------- */
/* Hash + size                                                            */
/* --------------------------------------------------------------------- */

function sha256(path: string): string {
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
}

/* --------------------------------------------------------------------- */
/* Upload                                                                 */
/* --------------------------------------------------------------------- */

async function uploadToStorage(localPath: string, remotePath: string): Promise<string> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error("FIREBASE_STORAGE_BUCKET env var not set");
  }
  const bucket = getStorage().bucket(bucketName);
  await bucket.upload(localPath, {
    destination: remotePath,
    metadata: {
      contentType: "application/x-sqlite3",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  const file = bucket.file(remotePath);
  await file.makePublic();
  return `https://storage.googleapis.com/${bucketName}/${remotePath}`;
}

/* --------------------------------------------------------------------- */
/* Main                                                                   */
/* --------------------------------------------------------------------- */

interface CliArgs {
  bundle?: string;
  all: boolean;
  upload: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { all: false, upload: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") out.all = true;
    else if (a === "--upload") out.upload = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--bundle") out.bundle = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.all && !args.bundle) {
    console.error("Usage: npm run build:bundles -- --all | --bundle <id> [--upload] [--dry-run]");
    process.exit(2);
  }

  const targets = args.all
    ? ALL_TARGETS
    : ALL_TARGETS.filter((t) => t.id === args.bundle);
  if (targets.length === 0) {
    console.error(`No matching bundle for --bundle ${args.bundle}`);
    process.exit(2);
  }

  const outDir = join(process.cwd(), "scripts", "bundles-output");
  mkdirSync(outDir, { recursive: true });
  const fs = db();

  const builtEntries: Array<Record<string, unknown>> = [];

  for (const target of targets) {
    const localPath = join(outDir, `${target.id}.v${target.version}.db`);
    console.log(`\n[${target.id}] building → ${localPath}`);
    await target.build(fs, localPath);
    const sizeBytes = statSync(localPath).size;
    const sha = sha256(localPath);
    let url = `local://${localPath}`;
    if (args.upload && !args.dryRun) {
      console.log(`  uploading to Firebase Storage ...`);
      url = await uploadToStorage(
        localPath,
        `bundles/${target.id}.v${target.version}.db`,
      );
      console.log(`  → ${url}`);
    }
    builtEntries.push({
      id: target.id,
      version: target.version,
      resource: target.resource,
      lang: target.lang,
      collection: target.collection ?? null,
      label: target.label,
      sizeBytes,
      sha256: sha,
      url,
      license: target.license,
      attribution: target.attribution,
      redistribute: target.redistribute,
      requires: target.requires,
      bundledWithApp: target.bundledWithApp,
    });
    console.log(`  size=${(sizeBytes / 1024 / 1024).toFixed(2)} MB  sha256=${sha.slice(0, 12)}…`);
  }

  if (args.dryRun) {
    console.log(
      `\n[dry-run] would update config/bundles with ${builtEntries.length} entry(ies):`,
    );
    console.log(JSON.stringify({ bundles: builtEntries }, null, 2));
    return;
  }

  console.log(`\n[manifest] merging into config/bundles ...`);
  const manifestRef = fs.collection("config").doc("bundles");
  const existing = await manifestRef.get();
  const existingBundles = Array.isArray(existing.data()?.bundles)
    ? (existing.data()?.bundles as Record<string, unknown>[])
    : [];

  const builtIds = new Set(builtEntries.map((b) => b.id as string));
  const merged = [
    ...existingBundles.filter((b) => !builtIds.has(b.id as string)),
    ...builtEntries,
  ];
  const manifestVersion =
    typeof existing.data()?.manifestVersion === "number"
      ? (existing.data()!.manifestVersion as number) + 1
      : 1;

  await manifestRef.set(
    {
      manifestVersion,
      generatedAt: FieldValue.serverTimestamp(),
      bundles: merged,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
  void Timestamp; // keep type import warm
  console.log(
    `  → manifestVersion=${manifestVersion}, total bundles=${merged.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
