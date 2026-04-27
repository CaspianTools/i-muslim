import type {
  HadithCollection,
  HadithEdition,
  HadithEntry,
  BookEntry,
} from "@/types/hadith";
import {
  HADITH_LANG_COVERAGE,
  HADITH_EDITION_LANG,
} from "./translations";
import type { LangCode } from "./translations";

const BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

export const COLLECTIONS: readonly HadithCollection[] = [
  {
    slug: "bukhari",
    name: "Sahih al-Bukhari",
    arabicName: "صحيح البخاري",
    shortName: "Bukhari",
  },
  {
    slug: "muslim",
    name: "Sahih Muslim",
    arabicName: "صحيح مسلم",
    shortName: "Muslim",
  },
  {
    slug: "abudawud",
    name: "Sunan Abu Dawud",
    arabicName: "سنن أبي داود",
    shortName: "Abu Dawud",
  },
  {
    slug: "tirmidhi",
    name: "Jami` at-Tirmidhi",
    arabicName: "جامع الترمذي",
    shortName: "Tirmidhi",
  },
  {
    slug: "nasai",
    name: "Sunan an-Nasa'i",
    arabicName: "سنن النسائي",
    shortName: "Nasa'i",
  },
  {
    slug: "ibnmajah",
    name: "Sunan Ibn Majah",
    arabicName: "سنن ابن ماجه",
    shortName: "Ibn Majah",
  },
  {
    slug: "malik",
    name: "Muwatta Malik",
    arabicName: "موطأ مالك",
    shortName: "Malik",
  },
  {
    slug: "nawawi",
    name: "40 Hadith Nawawi",
    arabicName: "الأربعون النووية",
    shortName: "Nawawi 40",
  },
  {
    slug: "qudsi",
    name: "40 Hadith Qudsi",
    arabicName: "الأربعون القدسية",
    shortName: "Qudsi 40",
  },
] as const;

export function getCollection(slug: string): HadithCollection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

type EditionLang = string;

function langToEdition(lang: LangCode): EditionLang | null {
  return HADITH_EDITION_LANG[lang] ?? null;
}

export function hasEdition(lang: LangCode, collection: string): boolean {
  if (lang === "ar") return true; // every collection has Arabic
  const set = HADITH_LANG_COVERAGE[lang];
  return set?.has(collection) ?? false;
}

// Hadith editions are 3-12MB each, exceeding Next.js's 2MB fetch-cache limit.
// Because the CDN source is version-pinned (@1), the data is effectively
// immutable — a process-lifetime in-memory cache is safe and avoids refetching
// ~6MB every time a user opens a book.
const editionCache = new Map<string, Promise<HadithEdition>>();

async function fetchEdition(
  editionLang: EditionLang,
  collection: string,
): Promise<HadithEdition> {
  const key = `${editionLang}-${collection}`;
  let promise = editionCache.get(key);
  if (promise) return promise;

  const url = `${BASE}/${key}.min.json`;
  promise = (async () => {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        `hadith-api ${key} failed: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as HadithEdition;
  })();
  editionCache.set(key, promise);
  // If the fetch fails, evict so the next request can retry.
  promise.catch(() => editionCache.delete(key));
  return promise;
}

export async function getArabicEdition(
  collection: string,
): Promise<HadithEdition> {
  return fetchEdition("ara", collection);
}

export async function getEditionsForLangs(
  collection: string,
  langs: LangCode[],
): Promise<
  Map<
    LangCode,
    { edition: HadithEdition; actualLang: LangCode; fallback: boolean }
  >
> {
  const jobs: Array<
    Promise<{
      requested: LangCode;
      actualLang: LangCode;
      edition: HadithEdition;
      fallback: boolean;
    } | null>
  > = [];

  // Collect unique editions needed. Arabic fetched separately through getArabicEdition.
  for (const lang of langs) {
    if (lang === "ar") continue;
    const editionLang = langToEdition(lang);
    const covered = editionLang && hasEdition(lang, collection);
    if (covered && editionLang) {
      jobs.push(
        fetchEdition(editionLang, collection).then((edition) => ({
          requested: lang,
          actualLang: lang,
          edition,
          fallback: false,
        })),
      );
    } else if (lang !== "en" && hasEdition("en", collection)) {
      const enEdition = HADITH_EDITION_LANG.en ?? "eng";
      jobs.push(
        fetchEdition(enEdition, collection).then((edition) => ({
          requested: lang,
          actualLang: "en" as LangCode,
          edition,
          fallback: true,
        })),
      );
    } else {
      jobs.push(Promise.resolve(null));
    }
  }

  const results = await Promise.all(jobs);
  const out = new Map<
    LangCode,
    { edition: HadithEdition; actualLang: LangCode; fallback: boolean }
  >();
  for (const r of results) {
    if (!r) continue;
    // Keep first occurrence (language order is stable from langs input).
    if (!out.has(r.requested)) {
      out.set(r.requested, {
        edition: r.edition,
        actualLang: r.actualLang,
        fallback: r.fallback,
      });
    }
  }
  return out;
}

export function getBooksFromEdition(edition: HadithEdition): BookEntry[] {
  const out: BookEntry[] = [];
  for (const key of Object.keys(edition.metadata.section_details)) {
    const n = Number(key);
    const name = edition.metadata.sections[key] ?? "";
    const det = edition.metadata.section_details[key];
    const count = Math.max(
      0,
      det.hadithnumber_last - det.hadithnumber_first + 1,
    );
    if (n === 0 || count === 0 || !name) continue;
    out.push({ number: n, name, count });
  }
  out.sort((a, b) => a.number - b.number);
  return out;
}

export function filterHadithsByBook(
  entries: HadithEntry[],
  bookNumber: number,
): HadithEntry[] {
  return entries.filter((h) => h.reference.book === bookNumber);
}

export function indexByHadithNumber(
  entries: HadithEntry[],
): Map<number, HadithEntry> {
  const map = new Map<number, HadithEntry>();
  for (const e of entries) map.set(e.hadithnumber, e);
  return map;
}
