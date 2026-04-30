/**
 * Seed Firestore with a single Hadith translation language.
 *
 * Usage:
 *   npm run seed:hadith:lang -- --lang=tr
 *
 * Reads HADITH_LANG_COVERAGE + HADITH_EDITION_LANG from lib/translations.ts
 * to figure out which fawazahmed0/hadith-api editions to fetch. For each
 * covered collection, fetches the edition from the jsdelivr CDN and merges
 * the text into each `hadith_entries` doc's `translations.<lang>` field.
 *
 * Idempotent and additive — does not touch other translations or Arabic text.
 * Skips per-language admin edits via `editedTranslations.<lang> === true`.
 * If a collection 404s on the CDN (coverage table is wrong / edition removed),
 * the script logs and continues with the next collection.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import { recomputeTranslationStats } from "./recompute-translation-stats";
import {
  ALL_LANGS,
  HADITH_LANG_COVERAGE,
  HADITH_EDITION_LANG,
} from "../lib/translations";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const HADITH_API = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
const WRITE_BATCH = 400;

type HadithEntry = {
  hadithnumber: number;
  text: string;
};
type Edition = { hadiths: HadithEntry[] };

function parseArgs(): { lang: string } {
  const args = process.argv.slice(2);
  let lang: string | null = null;
  for (const a of args) {
    if (a.startsWith("--lang=")) lang = a.slice("--lang=".length);
    else if (a === "--lang") {
      const i = args.indexOf(a);
      lang = args[i + 1] ?? null;
    }
  }
  if (!lang) {
    console.error("Missing --lang=<code> (e.g. --lang=tr)");
    process.exit(1);
  }
  return { lang };
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

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name} (check .env.local)`);
    process.exit(1);
  }
  return v;
}

async function fetchEdition(
  editionLang: string,
  slug: string,
): Promise<Edition | null> {
  const url = `${HADITH_API}/${editionLang}-${slug}.min.json`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return (await res.json()) as Edition;
}

function indexByNumber(entries: HadithEntry[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const e of entries) {
    if (e.text) m.set(e.hadithnumber, e.text);
  }
  return m;
}

async function seedCollectionForLang(
  firestore: Firestore,
  slug: string,
  lang: string,
  editionLang: string,
): Promise<{ written: number; preserved: number }> {
  console.log(`[${slug}] fetching ${editionLang}-${slug}…`);
  const edition = await fetchEdition(editionLang, slug);
  if (!edition) {
    console.warn(`[${slug}] edition ${editionLang}-${slug} not found on CDN — skipping`);
    return { written: 0, preserved: 0 };
  }
  const idx = indexByNumber(edition.hadiths);

  const col = firestore.collection("hadith_entries");
  const ids = Array.from(idx.keys()).map((n) => col.doc(`${slug}:${n}`));

  // Per-language preservation: docs flagged editedTranslations.<lang> stay.
  const preserveSet = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const snaps = await firestore.getAll(...chunk);
    for (const s of snaps) {
      if (!s.exists) continue;
      const data = s.data() ?? {};
      const perLang = (data.editedTranslations as Record<string, boolean> | undefined)?.[lang];
      if (perLang === true) preserveSet.add(s.id);
    }
  }

  let pending = firestore.batch();
  let pendingCount = 0;
  let written = 0;

  for (const [number, text] of idx) {
    const id = `${slug}:${number}`;
    if (preserveSet.has(id)) continue;
    // Nested-object form (NOT a dotted-key) so Firestore deep-merges into
    // the existing `translations` map rather than creating a literal field
    // named "translations.<lang>" that the renderer can't see.
    pending.set(
      col.doc(id),
      {
        translations: { [lang]: text },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: `seed:${lang}`,
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
  console.log(
    `[${slug}] wrote ${written} translations` +
      (preserveSet.size > 0 ? `, preserved ${preserveSet.size} admin-edited` : ""),
  );
  return { written, preserved: preserveSet.size };
}

async function main() {
  const { lang } = parseArgs();
  if (!ALL_LANGS.includes(lang)) {
    console.error(
      `Unknown lang "${lang}". Valid codes: ${ALL_LANGS.join(", ")}. Add new languages to lib/translations.ts first.`,
    );
    process.exit(1);
  }
  if (lang === "ar") {
    console.error("Arabic is the original text, not a translation. Run `npm run seed:hadith` for Arabic + canonical text.");
    process.exit(1);
  }
  const coverage = HADITH_LANG_COVERAGE[lang];
  if (!coverage || coverage.size === 0) {
    // Empty coverage = admin-edited-only language. Renderer falls back to
    // English with a "translation unavailable" badge; admin-edited entries
    // are preserved across seeds via the editedTranslations.<lang> flag.
    console.log(
      `No upstream hadith editions for "${lang}" — admin-edited only. Nothing to seed.`,
    );
    process.exit(0);
  }
  const editionLang = HADITH_EDITION_LANG[lang];
  if (!editionLang) {
    console.error(
      `HADITH_LANG_COVERAGE lists collections for "${lang}" but HADITH_EDITION_LANG has no edition prefix. Add the 3-letter fawazahmed0 edition prefix in lib/translations.ts.`,
    );
    process.exit(1);
  }

  const firestore = db();
  console.log(
    `Connecting to Firestore project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );
  console.log(
    `Seeding Hadith translation: lang=${lang} editionPrefix=${editionLang} collections=${[...coverage].join(",")}`,
  );

  let totalWritten = 0;
  let totalPreserved = 0;
  for (const slug of coverage) {
    try {
      const r = await seedCollectionForLang(firestore, slug, lang, editionLang);
      totalWritten += r.written;
      totalPreserved += r.preserved;
    } catch (err) {
      console.error(`[${slug}] FAILED:`, err);
    }
  }
  console.log(
    `Done. Wrote ${totalWritten} hadith translations, preserved ${totalPreserved} admin-edited.`,
  );
  // Refresh the per-language summary doc so /admin/settings reflects the seed.
  await recomputeTranslationStats(firestore);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
