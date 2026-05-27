import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb } from "@/lib/firebase/admin";

const COLLECTIONS_TAG = "hadith:collections";
const collectionTag = (slug: string) => `hadith:${slug}`;

const REVALIDATE_SECONDS = 60 * 60 * 24; // 1 day

// Canonical ordering used by the sharded sitemap (`generateSitemaps` returns
// `{id}` indices into this array) and by the API allowlists. Keep in sync.
export const HADITH_COLLECTION_SLUGS = [
  "bukhari",
  "muslim",
  "abudawud",
  "tirmidhi",
  "nasai",
  "ibnmajah",
  "malik",
  "nawawi",
  "qudsi",
] as const;

export type HadithCollectionDoc = {
  slug: string;
  name_en: string;
  name_ar: string;
  short_name?: string;
  total: number;
  books: Array<{ number: number; name: string; count: number }>;
};

export type HadithDoc = {
  collection: string;
  number: number;
  arabic_number?: number;
  book: number;
  hadith_in_book?: number;
  text_ar: string;
  // Open map keyed by LangCode. Missing or empty entries trigger the renderer's
  // English-fallback path; per-language seed scripts populate new keys.
  translations: Record<string, string | undefined>;
  // publishedTranslations.<lang> === true ⇒ that translation has been
  // reviewed and is visible to the public reader. Missing/false ⇒ Draft;
  // the reader renders an "in process" placeholder for that language only.
  publishedTranslations?: Record<string, boolean>;
  narrator: string | null;
  grade: string | null;
  grades?: Array<{ name: string; grade: string }>;
  tags: string[];
  notes: string | null;
  published: boolean;
};

const _getCollections = unstable_cache(
  async (): Promise<HadithCollectionDoc[]> => {
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection("hadith_collections").get();
    if (snap.empty) return [];
    return snap.docs.map((d) => d.data() as HadithCollectionDoc);
  },
  ["hadith:collections"],
  { revalidate: REVALIDATE_SECONDS, tags: [COLLECTIONS_TAG] },
);

export async function getHadithCollections(): Promise<HadithCollectionDoc[]> {
  return _getCollections();
}

export async function getHadithCollection(
  slug: string,
): Promise<HadithCollectionDoc | null> {
  const all = await _getCollections();
  return all.find((c) => c.slug === slug) ?? null;
}

export async function getHadithsByBook(
  slug: string,
  book: number,
): Promise<HadithDoc[]> {
  return unstable_cache(
    async (): Promise<HadithDoc[]> => {
      const db = getDb();
      if (!db) return [];
      const snap = await db
        .collection("hadith_entries")
        .where("collection", "==", slug)
        .where("book", "==", book)
        .where("published", "==", true)
        .get();
      if (snap.empty) return [];
      return snap.docs
        .map((d) => d.data() as HadithDoc)
        .sort((a, b) => a.number - b.number);
    },
    [`hadith:${slug}:book:${book}`],
    { revalidate: REVALIDATE_SECONDS, tags: [collectionTag(slug)] },
  )();
}

export async function getHadith(
  slug: string,
  number: number,
): Promise<HadithDoc | null> {
  return unstable_cache(
    async (): Promise<HadithDoc | null> => {
      const db = getDb();
      if (!db) return null;
      const doc = await db
        .collection("hadith_entries")
        .doc(`${slug}:${number}`)
        .get();
      if (!doc.exists) return null;
      return doc.data() as HadithDoc;
    },
    [`hadith:${slug}:${number}`],
    { revalidate: REVALIDATE_SECONDS, tags: [collectionTag(slug)] },
  )();
}

// Slim list of every published hadith number in a collection, used by the
// sharded sitemap and by adjacent-prev/next lookups. Field-masked so the
// 7,500-row Bukhari case stays cheap.
export async function listPublishedHadithNumbers(
  slug: string,
): Promise<number[]> {
  return unstable_cache(
    async (): Promise<number[]> => {
      const db = getDb();
      if (!db) return [];
      const snap = await db
        .collection("hadith_entries")
        .where("collection", "==", slug)
        .where("published", "==", true)
        .select("number")
        .get();
      if (snap.empty) return [];
      return snap.docs
        .map((d) => (d.data() as { number: number }).number)
        .filter((n): n is number => typeof n === "number")
        .sort((a, b) => a - b);
    },
    [`hadith:${slug}:numbers`],
    { revalidate: REVALIDATE_SECONDS, tags: [collectionTag(slug)] },
  )();
}

// Previous/next hadith numbers within the same collection (global number
// order). Backed by the same cached number list so a detail-page render
// doesn't hit Firestore twice.
export async function getAdjacentHadithNumbers(
  slug: string,
  number: number,
): Promise<{ prev: number | null; next: number | null }> {
  const numbers = await listPublishedHadithNumbers(slug);
  if (numbers.length === 0) return { prev: null, next: null };
  // Binary search for the position of `number`.
  let lo = 0;
  let hi = numbers.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = numbers[mid];
    if (v === number) {
      idx = mid;
      break;
    }
    if (v < number) lo = mid + 1;
    else hi = mid - 1;
  }
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? numbers[idx - 1] : null,
    next: idx < numbers.length - 1 ? numbers[idx + 1] : null,
  };
}

/**
 * Admin-only: returns every hadith in the collection including drafts. Not
 * cached — admin tooling needs the freshest write-after-edit state and the
 * traffic is negligible. Callers must gate with a permission check.
 */
export async function getAdminHadithsByCollection(
  slug: string,
): Promise<HadithDoc[]> {
  const db = getDb();
  if (!db) return [];
  const snap = await db
    .collection("hadith_entries")
    .where("collection", "==", slug)
    .get();
  if (snap.empty) return [];
  return snap.docs
    .map((d) => d.data() as HadithDoc)
    .sort((a, b) => a.number - b.number);
}

/** Admin-only sibling of getHadithsByBook that does NOT filter by published. */
export async function getAdminHadithsByBook(
  slug: string,
  book: number,
): Promise<HadithDoc[]> {
  const db = getDb();
  if (!db) return [];
  const snap = await db
    .collection("hadith_entries")
    .where("collection", "==", slug)
    .where("book", "==", book)
    .get();
  if (snap.empty) return [];
  return snap.docs
    .map((d) => d.data() as HadithDoc)
    .sort((a, b) => a.number - b.number);
}

export function revalidateHadithCollection(slug: string): void {
  revalidateTag(collectionTag(slug), { expire: 0 });
  revalidateTag(COLLECTIONS_TAG, { expire: 0 });
}
