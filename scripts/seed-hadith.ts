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
import { recomputeTranslationStats } from "./recompute-translation-stats";

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

/**
 * --only=<slug>   seed a single collection (repeatable, comma-separated)
 * --dry-run       fetch, diff and report; write nothing
 *
 * `--only` exists because a full re-run touches all 31,629 documents. Even now
 * that the write merges rather than replaces, the blast radius of a nine-
 * collection run is no longer something you want to take on by accident when
 * the goal is to backfill one collection.
 */
const ARGV = process.argv.slice(2);
const dryRun = ARGV.includes("--dry-run");
const onlyArg = ARGV.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const only = onlyArg
  ? new Set(onlyArg.split(",").map((x) => x.trim()).filter(Boolean))
  : null;

type HadithGrade = { name: string; grade: string };
type HadithEntry = {
  hadithnumber: number;
  /**
   * Absent on 344 of ara-muslim's 7,563 entries (every `reference.book === 0`
   * "Introduction" record, starting at index 0) — muslim is the only one of the
   * nine editions where this happens. Optional, and coalesced to null at the
   * write site: the Admin SDK throws on an `undefined` field value, which is
   * what left Sahih Muslim with zero documents.
   *
   * Also note the type: muslim carries STRING values here (e.g. "11.01") while
   * the other editions use numbers. Stored verbatim — nothing reads it as a
   * number — but the annotation says so rather than lying.
   */
  arabicnumber?: number | string;
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

  if (!dryRun) await seedCollectionMeta(firestore, c, ara);

  const engIdx = indexByNumber(eng.hadiths);
  const rusIdx = rus ? indexByNumber(rus.hadiths) : null;
  const col = firestore.collection("hadith_entries");

  // Bulk-read existing docs to detect edits we must not clobber. Two separate
  // signals, and BOTH matter:
  //   editedByAdmin        — whole doc is admin-owned, skip it entirely
  //   editedTranslations.X — this one language was authored/edited by i-muslim
  // Only the first was honoured before, and it is set on just ~1,086 of 31,629
  // docs, while ~28,000 carry per-language flags. Since the write below used to
  // replace the whole document, a re-run would have destroyed roughly 65,000
  // i-muslim-authored az/tr/ru translations (config/translationStats:
  // az 28,100 · tr 20,848 · ru 16,228).
  const refs = ara.hadiths.map((h) => col.doc(`${c.slug}:${h.hadithnumber}`));
  // Firestore getAll has a soft cap; chunk by 500.
  const editedSet = new Set<string>();
  const authoredLangs = new Map<string, Set<string>>();
  for (let i = 0; i < refs.length; i += 500) {
    const slice = refs.slice(i, i + 500);
    const snaps = await firestore.getAll(...slice);
    for (const s of snaps) {
      if (!s.exists) continue;
      const data = s.data() ?? {};
      if (data.editedByAdmin === true) editedSet.add(s.id);
      const flags = data.editedTranslations;
      if (flags && typeof flags === "object") {
        const langs = new Set(
          Object.entries(flags as Record<string, unknown>)
            .filter(([, v]) => v === true)
            .map(([k]) => k),
        );
        if (langs.size > 0) authoredLangs.set(s.id, langs);
      }
    }
  }
  if (editedSet.size > 0) {
    console.log(`[${c.slug}] preserving ${editedSet.size} admin-edited entries`);
  }
  if (authoredLangs.size > 0) {
    console.log(
      `[${c.slug}] preserving authored translations on ${authoredLangs.size} entries`,
    );
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

    // Never overwrite a language i-muslim authored or edited itself.
    const authored = authoredLangs.get(id);
    const translations: Record<string, string> = {};
    const publishedTranslations: Record<string, boolean> = {};
    if (!authored?.has("en") && enEntry?.text) {
      translations.en = enEntry.text;
      publishedTranslations.en = true;
    }
    if (!authored?.has("ru") && ruEntry?.text) {
      translations.ru = ruEntry.text;
      publishedTranslations.ru = true;
    }

    const payload = {
      collection: c.slug,
      number: h.hadithnumber,
      // ara-muslim omits this on its 344 book-0 entries. The Admin SDK rejects
      // `undefined` outright, and because the first muslim record is one of
      // them the batch threw before a single commit — zero documents written.
      arabic_number: h.arabicnumber ?? null,
      book: h.reference.book,
      hadith_in_book: h.reference.hadith,
      text_ar: h.text,
      translations,
      // Canonical upstream (fawazahmed0) is the trusted reference text — land
      // as Published. Admin edits bump editedByAdmin and are skipped by this
      // seeder, so manual unpublish choices are preserved across re-runs.
      publishedTranslations,
      narrator,
      grade,
      grades: h.grades,
      published: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "seed",
    };

    if (dryRun) {
      written++;
      continue;
    }

    // MERGE, never replace. A bare set() drops every field absent from the
    // payload — which is how a re-run would have wiped translations.az /
    // translations.tr, editedTranslations, tags and notes across the corpus.
    // `tags`, `notes` and `editedByAdmin` are deliberately no longer written at
    // all: they are reader/admin state, not upstream data, and seeding them was
    // what reset them.
    pending.set(col.doc(id), payload, { merge: true });
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

  const targets = COLLECTIONS.filter((c) => !only || only.has(c.slug));
  if (only) {
    const unknown = [...only].filter((sl) => !COLLECTIONS.some((c) => c.slug === sl));
    if (unknown.length > 0) {
      console.error(`Unknown --only slug(s): ${unknown.join(", ")}`);
      process.exit(1);
    }
    console.log(`Limiting to: ${targets.map((c) => c.slug).join(", ")}`);
  }
  if (dryRun) console.log("DRY RUN — nothing will be written.");

  const failed: string[] = [];
  for (const c of targets) {
    try {
      await seedCollection(firestore, c);
    } catch (err) {
      console.error(`[${c.slug}] FAILED:`, err);
      failed.push(c.slug);
    }
  }

  if (failed.length > 0) {
    // Exiting 0 here is what hid Sahih Muslim's failure for months: the run
    // printed "Done." and looked clean while one collection had written zero
    // documents. A non-zero exit makes the next failure impossible to miss.
    console.error(
      `
FAILED for ${failed.length} collection(s): ${failed.join(", ")} — see the errors above.`,
    );
    process.exit(1);
  }

  console.log("Done.");
  if (!dryRun) {
    // Refresh the translationStats doc so /admin/settings reflects the seed.
    await recomputeTranslationStats(firestore);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
