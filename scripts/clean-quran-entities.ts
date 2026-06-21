/**
 * One-off repair: decode HTML entities left in stored Quran translations.
 *
 * The Diyanet ml=1 (ayah-split) TR meal — and potentially other upstream
 * sources — encode quotes as `&quot;` (and apostrophes/ampersands as `&#39;`,
 * `&amp;`, …). The import/seed scripts now decode these on the way in, and the
 * public reader decodes them on the way out, but documents written before that
 * fix still hold the raw entities — which the v1 API serves verbatim.
 *
 * This script rewrites `quran_ayahs.translations.<lang>` in place, decoding HTML
 * entities for every language. It does NOT strip `<sup>` footnote tags (those
 * are intentionally preserved in the stored text and stripped only at render).
 *
 * Usage:
 *   npm run clean:quran:entities -- [--dry-run]
 *
 *   --dry-run   Report what would change, write nothing.
 *
 * Idempotent. Safe to re-run — only docs whose text actually changes are written.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import { decodeHtmlEntities } from "../lib/text/html";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const QURAN_COLLECTION = "quran_ayahs";
const WRITE_BATCH = 400; // Firestore hard cap is 500 ops/batch

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

async function main(): Promise<void> {
  const dryRun = process.argv.slice(2).includes("--dry-run");
  const firestore = db();
  console.log(
    `Connecting to Firestore project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );
  console.log(
    `Decoding HTML entities in ${QURAN_COLLECTION}.translations.*` +
      (dryRun ? "  [DRY RUN — no writes]" : ""),
  );

  const snap = await firestore.collection(QURAN_COLLECTION).get();
  if (snap.empty) {
    console.error(`${QURAN_COLLECTION} is empty — nothing to do.`);
    process.exit(1);
  }

  const perLang = new Map<string, number>(); // lang → fields changed
  type Op = { id: string; patch: Record<string, string> };
  const ops: Op[] = [];
  const samples: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const translations = data.translations as
      | Record<string, string | undefined>
      | undefined;
    if (!translations) continue;

    const patch: Record<string, string> = {};
    for (const [lang, text] of Object.entries(translations)) {
      if (typeof text !== "string") continue;
      const decoded = decodeHtmlEntities(text);
      if (decoded !== text) {
        patch[lang] = decoded;
        perLang.set(lang, (perLang.get(lang) ?? 0) + 1);
        if (samples.length < 5) {
          samples.push(`  ${doc.id} [${lang}]: ${text.slice(0, 80)}`);
        }
      }
    }
    if (Object.keys(patch).length > 0) ops.push({ id: doc.id, patch });
  }

  console.log(`[scan] ${snap.size} ayah docs scanned, ${ops.length} need decoding.`);
  if (perLang.size > 0) {
    console.log(
      "[scan] fields to decode per lang: " +
        [...perLang.entries()].map(([l, n]) => `${l}=${n}`).join(", "),
    );
  }
  if (samples.length > 0) {
    console.log("[scan] sample(s) (before):\n" + samples.join("\n"));
  }

  if (ops.length === 0) {
    console.log("Nothing to decode — data is already clean.");
    process.exit(0);
  }
  if (dryRun) {
    console.log(`[dry-run] would update ${ops.length} doc(s). No changes made.`);
    process.exit(0);
  }

  const col = firestore.collection(QURAN_COLLECTION);
  let written = 0;
  let pending = firestore.batch();
  let pendingCount = 0;
  for (const op of ops) {
    pending.set(
      col.doc(op.id),
      {
        translations: op.patch,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "clean:quran-entities",
      },
      { merge: true },
    );
    pendingCount++;
    written++;
    if (pendingCount >= WRITE_BATCH) {
      await pending.commit();
      pending = firestore.batch();
      pendingCount = 0;
    }
  }
  if (pendingCount > 0) await pending.commit();

  console.log(`Done. Updated ${written} ayah doc(s).`);
  console.log(
    `\nNote: the public reader caches surah reads for 1 day (unstable_cache); ` +
      `the API and admin editor reflect the change immediately.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
