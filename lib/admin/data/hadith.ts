import "server-only";
import { getDb } from "@/lib/firebase/admin";
import type {
  AdminHadithCollection,
  AdminHadith,
} from "@/types/admin-content";

export type { AdminHadithCollection, AdminHadith };

export type CollectionsResult = {
  collections: AdminHadithCollection[];
  source: "firestore" | "empty";
};

export type HadithsResult = {
  collection: AdminHadithCollection | null;
  entries: AdminHadith[];
  total: number;
  page: number;
  pageSize: number;
  source: "firestore" | "empty";
};

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "object" && v && "toDate" in v) {
    const fn = (v as { toDate: () => Date }).toDate;
    if (typeof fn === "function") return fn.call(v).toISOString();
  }
  return null;
}

function normalize(id: string, r: Record<string, unknown>): AdminHadith {
  const t = (r.translations as { en?: string; ru?: string }) ?? {};
  return {
    id,
    collection: r.collection as string,
    number: r.number as number,
    arabic_number: (r.arabic_number as number) ?? null,
    book: (r.book as number) ?? 0,
    hadith_in_book: (r.hadith_in_book as number) ?? null,
    text_ar: (r.text_ar as string) ?? "",
    translations: { en: t.en ?? "", ru: t.ru ?? "" },
    narrator: (r.narrator as string) ?? null,
    grade: (r.grade as string) ?? null,
    tags: ((r.tags as string[]) ?? []),
    notes: (r.notes as string) ?? null,
    published: r.published !== false,
    editedByAdmin: Boolean(r.editedByAdmin),
    updatedAt: tsToIso(r.updatedAt),
    updatedBy: (r.updatedBy as string) ?? null,
  };
}

export async function fetchCollections(): Promise<CollectionsResult> {
  const db = getDb();
  if (!db) return { collections: [], source: "empty" };
  const snap = await db.collection("hadith_collections").get();
  if (snap.empty) return { collections: [], source: "empty" };

  // Count edited entries per collection — single query, group in memory.
  const editedSnap = await db
    .collection("hadith_entries")
    .where("editedByAdmin", "==", true)
    .get();
  const editedCounts = new Map<string, number>();
  for (const d of editedSnap.docs) {
    const slug = (d.data() as { collection: string }).collection;
    editedCounts.set(slug, (editedCounts.get(slug) ?? 0) + 1);
  }

  const collections: AdminHadithCollection[] = snap.docs
    .map((d) => {
      const r = d.data() as AdminHadithCollection;
      return {
        slug: r.slug,
        name_en: r.name_en,
        name_ar: r.name_ar,
        short_name: r.short_name,
        total: r.total,
        books: r.books ?? [],
        edited_count: editedCounts.get(r.slug) ?? 0,
      };
    })
    .sort((a, b) => a.name_en.localeCompare(b.name_en));

  return { collections, source: "firestore" };
}

export async function fetchCollectionWithHadiths(
  slug: string,
  opts: { page?: number; pageSize?: number; book?: number } = {},
): Promise<HadithsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(200, opts.pageSize ?? 50));
  const db = getDb();
  if (!db) {
    return {
      collection: null,
      entries: [],
      total: 0,
      page,
      pageSize,
      source: "empty",
    };
  }

  const collectionDoc = await db.collection("hadith_collections").doc(slug).get();
  if (!collectionDoc.exists) {
    return {
      collection: null,
      entries: [],
      total: 0,
      page,
      pageSize,
      source: "empty",
    };
  }
  const meta = collectionDoc.data() as AdminHadithCollection;

  let q = db
    .collection("hadith_entries")
    .where("collection", "==", slug)
    .orderBy("number");

  if (typeof opts.book === "number") {
    q = db
      .collection("hadith_entries")
      .where("collection", "==", slug)
      .where("book", "==", opts.book)
      .orderBy("number");
  }

  const offset = (page - 1) * pageSize;
  const snap = await q.offset(offset).limit(pageSize).get();
  const entries = snap.docs.map((d) => normalize(d.id, d.data()));

  return {
    collection: { ...meta, books: meta.books ?? [] },
    entries,
    total: meta.total,
    page,
    pageSize,
    source: "firestore",
  };
}
