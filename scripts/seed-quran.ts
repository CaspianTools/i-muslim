/**
 * Seed Firestore with the full Quran from quran.com.
 *
 * Run: npm run seed:quran
 *
 * Idempotent: docs where editedByAdmin === true are left alone, so re-running
 * after admin edits is safe. Re-running without admin edits simply re-writes
 * the canonical text/translations.
 *
 * Translation IDs (from quran.com /api/v4/resources/translations):
 *   20  Saheeh International (English)
 *   45  Elmir Kuliev (Russian)
 *   57  Transliteration (Latin)
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const TRANSLATION_IDS = { en: 20, ru: 45, translit: 57 } as const;

const QURAN_API = "https://api.quran.com/api/v4";
const SURAH_BATCH = 1; // surahs at a time (sequential, not parallel — be a good citizen)
const WRITE_BATCH = 400; // Firestore allows 500 ops per commit; leave headroom

type ApiTranslation = { id: number; resource_id: number; text: string };
type ApiVerse = {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  juz_number: number;
  page_number: number;
  sajdah_number: number | null;
  translations: ApiTranslation[];
};
type ApiChapter = {
  id: number;
  revelation_place: "makkah" | "madinah";
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  translated_name: { language_name: string; name: string };
};

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

async function fetchVerses(chapterId: number): Promise<ApiVerse[]> {
  const params = new URLSearchParams({
    fields: "text_uthmani,juz_number,page_number,sajdah_number",
    translations: `${TRANSLATION_IDS.en},${TRANSLATION_IDS.ru},${TRANSLATION_IDS.translit}`,
    per_page: "300",
  });
  const data = await fetchJson<{ verses: ApiVerse[] }>(
    `${QURAN_API}/verses/by_chapter/${chapterId}?${params.toString()}`,
  );
  return data.verses;
}

function pickTranslation(verse: ApiVerse, resourceId: number): string | null {
  const t = verse.translations.find((tr) => tr.resource_id === resourceId);
  return t ? stripHtml(t.text) : null;
}

async function seedSurahMeta(firestore: Firestore, chapters: ApiChapter[]) {
  const col = firestore.collection("quran_surahs");
  const batch = firestore.batch();
  for (const c of chapters) {
    batch.set(
      col.doc(String(c.id)),
      {
        number: c.id,
        name_ar: c.name_arabic,
        name_en: c.name_simple,
        name_complex: c.name_complex,
        name_translated: c.translated_name.name,
        revelation_place: c.revelation_place,
        ayah_count: c.verses_count,
        bismillah_pre: c.bismillah_pre,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
  console.log(`[surahs] wrote ${chapters.length} docs`);
}

async function seedSurahAyahs(firestore: Firestore, chapter: ApiChapter) {
  const col = firestore.collection("quran_ayahs");
  const verses = await fetchVerses(chapter.id);
  if (verses.length !== chapter.verses_count) {
    console.warn(
      `[surah ${chapter.id}] expected ${chapter.verses_count} verses, got ${verses.length}`,
    );
  }

  // Bulk-read existing docs to detect editedByAdmin flags.
  const refs = verses.map((v) => col.doc(`${chapter.id}:${v.verse_number}`));
  const snaps = await firestore.getAll(...refs);
  const editedSet = new Set<string>();
  for (const s of snaps) {
    if (s.exists && s.data()?.editedByAdmin === true) editedSet.add(s.id);
  }
  if (editedSet.size > 0) {
    console.log(
      `[surah ${chapter.id}] preserving ${editedSet.size} admin-edited ayahs`,
    );
  }

  let pending = firestore.batch();
  let pendingCount = 0;
  let written = 0;

  for (const v of verses) {
    const id = `${chapter.id}:${v.verse_number}`;
    if (editedSet.has(id)) continue;

    const en = pickTranslation(v, TRANSLATION_IDS.en) ?? "";
    const ru = pickTranslation(v, TRANSLATION_IDS.ru) ?? "";
    const translit = pickTranslation(v, TRANSLATION_IDS.translit);

    pending.set(col.doc(id), {
      surah: chapter.id,
      ayah: v.verse_number,
      text_ar: v.text_uthmani,
      text_translit: translit,
      translations: { en, ru },
      juz: v.juz_number,
      page: v.page_number,
      sajdah: v.sajdah_number !== null,
      tags: [],
      notes: null,
      published: true,
      editedByAdmin: false,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "seed",
    });
    pendingCount++;
    written++;

    if (pendingCount >= WRITE_BATCH) {
      await pending.commit();
      pending = firestore.batch();
      pendingCount = 0;
    }
  }
  if (pendingCount > 0) await pending.commit();
  console.log(`[surah ${chapter.id} ${chapter.name_simple}] wrote ${written} ayahs`);
}

async function main() {
  const firestore = db();
  console.log(
    `Connecting to Firestore project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );

  const chapters = await fetchChapters();
  console.log(`Fetched ${chapters.length} chapters from quran.com`);

  await seedSurahMeta(firestore, chapters);

  // Sequential by surah to avoid hammering the API.
  for (let i = 0; i < chapters.length; i += SURAH_BATCH) {
    const slice = chapters.slice(i, i + SURAH_BATCH);
    await Promise.all(slice.map((c) => seedSurahAyahs(firestore, c)));
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
