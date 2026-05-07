import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb } from "@/lib/firebase/admin";

const COLLECTIONS_TAG = "hadith:collections";
const collectionTag = (slug: string) => `hadith:${slug}`;

const REVALIDATE_SECONDS = 60 * 60 * 24; // 1 day

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

export async function getHadithsByCollection(
  slug: string,
): Promise<HadithDoc[]> {
  return unstable_cache(
    async (): Promise<HadithDoc[]> => {
      const db = getDb();
      if (!db) return [];
      const snap = await db
        .collection("hadith_entries")
        .where("collection", "==", slug)
        .where("published", "==", true)
        .get();
      if (snap.empty) return [];
      return snap.docs
        .map((d) => d.data() as HadithDoc)
        .sort((a, b) => a.number - b.number);
    },
    [`hadith:${slug}:all`],
    { revalidate: REVALIDATE_SECONDS, tags: [collectionTag(slug)] },
  )();
}

export async function getHadith(
  slug: string,
  number: number,
): Promise<HadithDoc | null> {
  const db = getDb();
  if (!db) return null;
  const doc = await db
    .collection("hadith_entries")
    .doc(`${slug}:${number}`)
    .get();
  if (!doc.exists) return null;
  return doc.data() as HadithDoc;
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
