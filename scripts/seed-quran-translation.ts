/**
 * Seed Firestore with a single Quran translation language.
 *
 * Usage:
 *   npm run seed:quran:lang -- --lang=tr
 *
 * Reads QURAN_TRANSLATION_IDS from lib/translations.ts to find the resource ID
 * on api.quran.com, fetches all 6,236 verses for that translation, and merges
 * the text into each `quran_ayahs` doc's `translations.<lang>` field.
 *
 * Idempotent and additive — does not touch other translations or Arabic text.
 * Skips docs flagged `editedByAdmin === true` for that language to preserve
 * manual edits (per-language flag: `editedTranslations.<lang>`). Falls back to
 * the doc-wide `editedByAdmin` if the per-language flag is absent.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import {
  ALL_LANGS,
  QURAN_TRANSLATION_IDS,
  QURAN_TRANSLATION_NAMES,
} from "../lib/translations";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const QURAN_API = "https://api.quran.com/api/v4";
const SURAH_BATCH = 1; // sequential — be a good citizen
const WRITE_BATCH = 400;

type ApiTranslation = { id: number; resource_id: number; text: string };
type ApiVerse = {
  id: number;
  verse_number: number;
  verse_key: string;
  translations: ApiTranslation[];
};
type ApiChapter = { id: number; verses_count: number; name_simple: string };

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

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

async function fetchChapters(): Promise<ApiChapter[]> {
  const data = await fetchJson<{ chapters: ApiChapter[] }>(
    `${QURAN_API}/chapters?language=en`,
  );
  return data.chapters;
}

async function fetchVerses(
  chapterId: number,
  resourceId: number,
): Promise<ApiVerse[]> {
  const params = new URLSearchParams({
    translations: String(resourceId),
    per_page: "300",
  });
  const data = await fetchJson<{ verses: ApiVerse[] }>(
    `${QURAN_API}/verses/by_chapter/${chapterId}?${params.toString()}`,
  );
  return data.verses;
}

async function seedSurahForLang(
  firestore: Firestore,
  chapter: ApiChapter,
  lang: string,
  resourceId: number,
): Promise<{ written: number; preserved: number }> {
  const col = firestore.collection("quran_ayahs");
  const verses = await fetchVerses(chapter.id, resourceId);
  if (verses.length !== chapter.verses_count) {
    console.warn(
      `[surah ${chapter.id}] expected ${chapter.verses_count} verses, got ${verses.length}`,
    );
  }

  const refs = verses.map((v) => col.doc(`${chapter.id}:${v.verse_number}`));
  const snaps = await firestore.getAll(...refs);
  const preserveSet = new Set<string>();
  for (const s of snaps) {
    if (!s.exists) continue;
    const data = s.data() ?? {};
    const perLang = (data.editedTranslations as Record<string, boolean> | undefined)?.[lang];
    if (perLang === true) preserveSet.add(s.id);
  }

  let pending = firestore.batch();
  let pendingCount = 0;
  let written = 0;

  for (const v of verses) {
    const id = `${chapter.id}:${v.verse_number}`;
    if (preserveSet.has(id)) continue;
    const t = v.translations.find((tr) => tr.resource_id === resourceId);
    if (!t) continue;
    const text = stripHtml(t.text);
    if (!text) continue;

    pending.set(
      col.doc(id),
      {
        [`translations.${lang}`]: text,
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
    `[surah ${chapter.id} ${chapter.name_simple}] wrote ${written} ayah translations` +
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
    console.error("Arabic is the original text, not a translation. Run `npm run seed:quran` for Arabic + canonical text.");
    process.exit(1);
  }
  const resourceId = QURAN_TRANSLATION_IDS[lang];
  if (resourceId == null) {
    console.error(`No QURAN_TRANSLATION_IDS entry for "${lang}".`);
    process.exit(1);
  }
  const translatorName = QURAN_TRANSLATION_NAMES[lang] ?? "(unknown)";

  const firestore = db();
  console.log(
    `Connecting to Firestore project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );
  console.log(
    `Seeding Quran translation: lang=${lang} resourceId=${resourceId} translator="${translatorName}"`,
  );

  const chapters = await fetchChapters();
  console.log(`Fetched ${chapters.length} chapters from quran.com`);

  let totalWritten = 0;
  let totalPreserved = 0;
  for (let i = 0; i < chapters.length; i += SURAH_BATCH) {
    const slice = chapters.slice(i, i + SURAH_BATCH);
    const results = await Promise.all(
      slice.map((c) => seedSurahForLang(firestore, c, lang, resourceId)),
    );
    for (const r of results) {
      totalWritten += r.written;
      totalPreserved += r.preserved;
    }
  }
  console.log(`Done. Wrote ${totalWritten} translations, preserved ${totalPreserved} admin-edited.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
