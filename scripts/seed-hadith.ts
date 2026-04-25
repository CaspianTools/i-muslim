/**
 * Seed Firestore with all 9 Hadith collections from fawazahmed0/hadith-api (jsdelivr CDN).
 *
 * Run: npm run seed:hadith
 *
 * Idempotent: docs where editedByAdmin === true are left alone.
 *
 * Per-language coverage matches lib/translations.ts HADITH_LANG_COVERAGE:
 *   English: all 9 collections
 *   Russian: bukhari, muslim, abudawud only (others get empty ru translation)
 *   Arabic:  all 9 collections
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

const HADITH_API = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";
const WRITE_BATCH = 400;

const COLLECTIONS = [
  { slug: "bukhari", name_en: "Sahih al-Bukhari", name_ar: "صحيح البخاري", short: "Bukhari" },
  { slug: "muslim", name_en: "Sahih Muslim", name_ar: "صحيح مسلم", short: "Muslim" },
  { slug: "abudawud", name_en: "Sunan Abu Dawud", name_ar: "سنن أبي داود", short: "Abu Dawud" },
  { slug: "tirmidhi", name_en: "Jami` at-Tirmidhi", name_ar: "جامع الترمذي", short: "Tirmidhi" },
  { slug: "nasai", name_en: "Sunan an-Nasa'i", name_ar: "سنن النسائي", short: "Nasa'i" },
  { slug: "ibnmajah", name_en: "Sunan Ibn Majah", name_ar: "سنن ابن ماجه", short: "Ibn Majah" },
  { slug: "malik", name_en: "Muwatta Malik", name_ar: "موطأ مالك", short: "Malik" },
  { slug: "nawawi", name_en: "40 Hadith Nawawi", name_ar: "الأربعون النووية", short: "Nawawi 40" },
  { slug: "qudsi", name_en: "40 Hadith Qudsi", name_ar: "الأربعون القدسية", short: "Qudsi 40" },
] as const;

const HAS_RUSSIAN = new Set(["bukhari", "muslim", "abudawud"]);

type HadithGrade = { name: string; grade: string };
type HadithEntry = {
  hadithnumber: number;
  arabicnumber: number;
  text: string;
  grades: HadithGrade[];
  reference: { book: number; hadith: number };
};
type SectionDetails = {
  hadithnumber_first: number;
  hadithnumber_last: number;
  arabicnumber_first: number;
  arabicnumber_last: number;
};
type Edition = {
  metadata: {
    name: string;
    sections: Record<string, string>;
    section_details: Record<string, SectionDetails>;
  };
  hadiths: HadithEntry[];
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

async function fetchEdition(lang: "ara" | "eng" | "rus", slug: string): Promise<Edition> {
  const url = `${HADITH_API}/${lang}-${slug}.min.json`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status} ${res.statusText}`);
  return (await res.json()) as Edition;
}

function indexByNumber(entries: HadithEntry[]): Map<number, HadithEntry> {
  const m = new Map<number, HadithEntry>();
  for (const e of entries) m.set(e.hadithnumber, e);
  return m;
}

async function seedCollectionMeta(
  firestore: Firestore,
  c: (typeof COLLECTIONS)[number],
  arabic: Edition,
) {
  const books: Array<{ number: number; name: string; count: number }> = [];
  for (const key of Object.keys(arabic.metadata.section_details)) {
    const n = Number(key);
    const det = arabic.metadata.section_details[key];
    const name = arabic.metadata.sections[key] ?? "";
    const count = Math.max(0, det.hadithnumber_last - det.hadithnumber_first + 1);
    if (n === 0 || count === 0 || !name) continue;
    books.push({ number: n, name, count });
  }
  books.sort((a, b) => a.number - b.number);

  await firestore.collection("hadith_collections").doc(c.slug).set(
    {
      slug: c.slug,
      name_en: c.name_en,
      name_ar: c.name_ar,
      short_name: c.short,
      total: arabic.hadiths.length,
      books,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`[${c.slug}] meta written (${books.length} books, ${arabic.hadiths.length} hadiths)`);
}

async function seedCollection(firestore: Firestore, c: (typeof COLLECTIONS)[number]) {
  console.log(`[${c.slug}] fetching editions…`);
  const wantRussian = HAS_RUSSIAN.has(c.slug);
  const [ara, eng, rus] = await Promise.all([
    fetchEdition("ara", c.slug),
    fetchEdition("eng", c.slug),
    wantRussian ? fetchEdition("rus", c.slug) : Promise.resolve<Edition | null>(null),
  ]);

  await seedCollectionMeta(firestore, c, ara);

  const engIdx = indexByNumber(eng.hadiths);
  const rusIdx = rus ? indexByNumber(rus.hadiths) : null;
  const col = firestore.collection("hadith_entries");

  // Bulk-read existing docs to detect editedByAdmin flags.
  const refs = ara.hadiths.map((h) => col.doc(`${c.slug}:${h.hadithnumber}`));
  // Firestore getAll has a soft cap; chunk by 500.
  const editedSet = new Set<string>();
  for (let i = 0; i < refs.length; i += 500) {
    const slice = refs.slice(i, i + 500);
    const snaps = await firestore.getAll(...slice);
    for (const s of snaps) {
      if (s.exists && s.data()?.editedByAdmin === true) editedSet.add(s.id);
    }
  }
  if (editedSet.size > 0) {
    console.log(`[${c.slug}] preserving ${editedSet.size} admin-edited entries`);
  }

  let pending = firestore.batch();
  let pendingCount = 0;
  let written = 0;

  for (const h of ara.hadiths) {
    const id = `${c.slug}:${h.hadithnumber}`;
    if (editedSet.has(id)) continue;

    const enEntry = engIdx.get(h.hadithnumber) ?? null;
    const ruEntry = rusIdx?.get(h.hadithnumber) ?? null;

    const grade = h.grades.find((g) => g.grade)?.grade ?? null;
    const narrator = enEntry?.text.match(/^Narrated\s+([^:]+):/)?.[1] ?? null;

    pending.set(col.doc(id), {
      collection: c.slug,
      number: h.hadithnumber,
      arabic_number: h.arabicnumber,
      book: h.reference.book,
      hadith_in_book: h.reference.hadith,
      text_ar: h.text,
      translations: {
        en: enEntry?.text ?? "",
        ru: ruEntry?.text ?? "",
      },
      narrator,
      grade,
      grades: h.grades,
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
  console.log(`[${c.slug}] wrote ${written} entries (skipped ${editedSet.size})`);
}

async function main() {
  const firestore = db();
  console.log(
    `Connecting to Firestore project=${process.env.FIREBASE_PROJECT_ID} db=${process.env.FIREBASE_DATABASE_ID ?? "main"}`,
  );

  for (const c of COLLECTIONS) {
    try {
      await seedCollection(firestore, c);
    } catch (err) {
      console.error(`[${c.slug}] FAILED:`, err);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
