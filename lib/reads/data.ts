import "server-only";
import {
  Timestamp,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { getDb, requireDb } from "@/lib/firebase/admin";
import {
  emptyReadsSummary,
  type HadithCollectionReadSummary,
  type ReadItemType,
  type ReadMark,
  type ReadsSummary,
  type SerializedReadMark,
} from "@/types/reads";
import { parseReadId, readIdFromMark } from "@/lib/reads/ids";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function readsCol(db: Firestore, uid: string) {
  return db.collection("users").doc(uid).collection("reads");
}

function summaryRef(db: Firestore, uid: string): DocumentReference {
  return db.collection("users").doc(uid).collection("state").doc("readsSummary");
}

function normalizeSummary(raw: unknown): ReadsSummary {
  const out = emptyReadsSummary();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  const quran = r.quran as Record<string, unknown> | undefined;
  if (quran) {
    out.quran.surahsRead =
      typeof quran.surahsRead === "number" ? quran.surahsRead : 0;
    const latest = quran.latest as Record<string, unknown> | undefined;
    if (latest && typeof latest.surahId === "number") {
      out.quran.latest = { surahId: latest.surahId, at: tsToIso(latest.at) };
    }
  }

  const hadith = r.hadith as Record<string, unknown> | undefined;
  if (hadith) {
    out.hadith.total = typeof hadith.total === "number" ? hadith.total : 0;
    const byCollection = hadith.byCollection as
      | Record<string, unknown>
      | undefined;
    if (byCollection && typeof byCollection === "object") {
      for (const [slug, val] of Object.entries(byCollection)) {
        if (!val || typeof val !== "object") continue;
        const v = val as Record<string, unknown>;
        const byBookRaw =
          (v.byBook as Record<string, unknown> | undefined) ?? {};
        const byBook: Record<string, number> = {};
        for (const [book, count] of Object.entries(byBookRaw)) {
          if (typeof count === "number") byBook[book] = count;
        }
        const summary: HadithCollectionReadSummary = {
          total: typeof v.total === "number" ? v.total : 0,
          byBook,
        };
        const latest = v.latest as Record<string, unknown> | undefined;
        if (
          latest &&
          typeof latest.book === "number" &&
          typeof latest.number === "number"
        ) {
          summary.latest = {
            book: latest.book,
            number: latest.number,
            at: tsToIso(latest.at),
          };
        }
        out.hadith.byCollection[slug] = summary;
      }
    }
    const latest = hadith.latest as Record<string, unknown> | undefined;
    if (
      latest &&
      typeof latest.collection === "string" &&
      typeof latest.book === "number" &&
      typeof latest.number === "number"
    ) {
      out.hadith.latest = {
        collection: latest.collection,
        book: latest.book,
        number: latest.number,
        at: tsToIso(latest.at),
      };
    }
  }

  out.updatedAt = tsToIso(r.updatedAt);
  return out;
}

function serializeSummary(s: ReadsSummary): Record<string, unknown> {
  return {
    quran: {
      surahsRead: s.quran.surahsRead,
      latest: s.quran.latest ?? null,
    },
    hadith: {
      total: s.hadith.total,
      byCollection: s.hadith.byCollection,
      latest: s.hadith.latest ?? null,
    },
    updatedAt: s.updatedAt,
  };
}

export function applyMark(
  s: ReadsSummary,
  mark: ReadMark,
  at: Date | string,
): ReadsSummary {
  const atIso = typeof at === "string" ? at : at.toISOString();
  if (mark.itemType === "surah") {
    const prevLatest = s.quran.latest;
    const latest =
      !prevLatest || prevLatest.at <= atIso
        ? { surahId: mark.surahId, at: atIso }
        : prevLatest;
    return {
      ...s,
      quran: { surahsRead: s.quran.surahsRead + 1, latest },
      updatedAt: atIso,
    };
  }
  const slug = mark.collection;
  const existing = s.hadith.byCollection[slug] ?? { total: 0, byBook: {} };
  const bookKey = String(mark.book);
  const colPrevLatest = existing.latest;
  const colLatest =
    !colPrevLatest || colPrevLatest.at <= atIso
      ? { book: mark.book, number: mark.number, at: atIso }
      : colPrevLatest;
  const newCol: HadithCollectionReadSummary = {
    total: existing.total + 1,
    byBook: {
      ...existing.byBook,
      [bookKey]: (existing.byBook[bookKey] ?? 0) + 1,
    },
    latest: colLatest,
  };
  const globalPrev = s.hadith.latest;
  const globalLatest =
    !globalPrev || globalPrev.at <= atIso
      ? { collection: slug, book: mark.book, number: mark.number, at: atIso }
      : globalPrev;
  return {
    ...s,
    hadith: {
      total: s.hadith.total + 1,
      byCollection: { ...s.hadith.byCollection, [slug]: newCol },
      latest: globalLatest,
    },
    updatedAt: atIso,
  };
}

export function applyUnmark(s: ReadsSummary, mark: ReadMark): ReadsSummary {
  const atIso = new Date().toISOString();
  if (mark.itemType === "surah") {
    const latest = s.quran.latest;
    const newLatest =
      latest && latest.surahId === mark.surahId ? undefined : latest;
    return {
      ...s,
      quran: {
        surahsRead: Math.max(0, s.quran.surahsRead - 1),
        latest: newLatest,
      },
      updatedAt: atIso,
    };
  }
  const slug = mark.collection;
  const existing = s.hadith.byCollection[slug];
  if (!existing) return { ...s, updatedAt: atIso };
  const bookKey = String(mark.book);
  const newByBook = { ...existing.byBook };
  const newBookCount = Math.max(0, (newByBook[bookKey] ?? 1) - 1);
  if (newBookCount === 0) delete newByBook[bookKey];
  else newByBook[bookKey] = newBookCount;

  const newColTotal = Math.max(0, existing.total - 1);
  const colLatestMatches =
    existing.latest &&
    existing.latest.book === mark.book &&
    existing.latest.number === mark.number;
  const newColLatest = colLatestMatches ? undefined : existing.latest;

  const newByCollection = { ...s.hadith.byCollection };
  if (newColTotal === 0 && !newColLatest) {
    delete newByCollection[slug];
  } else {
    newByCollection[slug] = {
      total: newColTotal,
      byBook: newByBook,
      latest: newColLatest,
    };
  }

  const latest = s.hadith.latest;
  const newGlobalLatest =
    latest &&
    latest.collection === slug &&
    latest.book === mark.book &&
    latest.number === mark.number
      ? undefined
      : latest;

  return {
    ...s,
    hadith: {
      total: Math.max(0, s.hadith.total - 1),
      byCollection: newByCollection,
      latest: newGlobalLatest,
    },
    updatedAt: atIso,
  };
}

export async function getReadsSummary(uid: string): Promise<ReadsSummary> {
  const db = getDb();
  if (!db) return emptyReadsSummary();
  try {
    const snap = await summaryRef(db, uid).get();
    if (!snap.exists) return emptyReadsSummary();
    return normalizeSummary(snap.data());
  } catch (err) {
    console.warn("[reads/data] getReadsSummary failed:", err);
    return emptyReadsSummary();
  }
}

/**
 * Returns the set of readIds the user has marked, filtered by item type.
 * Used by content pages to seed initial mark state without N+1 lookups.
 */
export async function getReadSet(
  uid: string,
  itemType: ReadItemType,
): Promise<Set<string>> {
  const db = getDb();
  if (!db) return new Set();
  try {
    const snap = await readsCol(db, uid)
      .where("itemType", "==", itemType)
      .select()
      .get();
    const set = new Set<string>();
    for (const doc of snap.docs) set.add(doc.id);
    return set;
  } catch (err) {
    console.warn("[reads/data] getReadSet failed:", err);
    return new Set();
  }
}

export interface ToggleReadResult {
  marked: boolean;
  readAt: string;
}

export async function toggleRead(
  uid: string,
  mark: ReadMark,
): Promise<ToggleReadResult> {
  const db = requireDb();
  const readId = readIdFromMark(mark);
  const readRef = readsCol(db, uid).doc(readId);
  const sumRef = summaryRef(db, uid);

  return db.runTransaction(async (tx) => {
    const [readSnap, sumSnap] = await Promise.all([
      tx.get(readRef),
      tx.get(sumRef),
    ]);
    const summary = normalizeSummary(sumSnap.exists ? sumSnap.data() : null);

    if (readSnap.exists) {
      tx.delete(readRef);
      const next = applyUnmark(summary, mark);
      tx.set(sumRef, serializeSummary(next));
      return { marked: false, readAt: tsToIso(readSnap.get("readAt")) };
    }

    const now = new Date();
    const docData: Record<string, unknown> = {
      itemType: mark.itemType,
      readAt: Timestamp.fromDate(now),
    };
    if (mark.itemType === "hadith") {
      docData.collection = mark.collection;
      docData.book = mark.book;
      docData.number = mark.number;
    } else {
      docData.surahId = mark.surahId;
    }
    tx.set(readRef, docData);
    const next = applyMark(summary, mark, now);
    tx.set(sumRef, serializeSummary(next));
    return { marked: true, readAt: now.toISOString() };
  });
}

export async function resetReads(uid: string): Promise<void> {
  const db = requireDb();
  while (true) {
    const snap = await readsCol(db, uid).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    if (snap.size < 400) break;
  }
  await summaryRef(db, uid).set(serializeSummary(emptyReadsSummary()));
}

/**
 * Merges localStorage-shaped read marks into Firestore for newly-signed-in users.
 * Existing marks keep their earlier readAt; only new readIds are inserted.
 * Returns the count actually added and the rebuilt summary.
 */
export async function mergeReadsFromLocal(
  uid: string,
  items: SerializedReadMark[],
): Promise<{ added: number; summary: ReadsSummary }> {
  const db = requireDb();
  if (items.length === 0) {
    return { added: 0, summary: await getReadsSummary(uid) };
  }

  const validItems: SerializedReadMark[] = [];
  for (const item of items) {
    if (!item || typeof item.readId !== "string") continue;
    const mark = parseReadId(item.readId);
    if (!mark) continue;
    validItems.push({
      readId: item.readId,
      mark,
      readAt:
        typeof item.readAt === "string" && item.readAt
          ? item.readAt
          : new Date().toISOString(),
    });
  }

  if (validItems.length === 0) {
    return { added: 0, summary: await getReadsSummary(uid) };
  }

  const colRef = readsCol(db, uid);
  const existingIds = new Set<string>();
  const CHUNK = 25;
  for (let i = 0; i < validItems.length; i += CHUNK) {
    const slice = validItems.slice(i, i + CHUNK);
    const snaps = await Promise.all(
      slice.map((it) => colRef.doc(it.readId).get()),
    );
    snaps.forEach((s, idx) => {
      if (s.exists) existingIds.add(slice[idx]!.readId);
    });
  }

  const toAdd = validItems.filter((it) => !existingIds.has(it.readId));

  for (let i = 0; i < toAdd.length; i += 400) {
    const batch = db.batch();
    for (const item of toAdd.slice(i, i + 400)) {
      const docData: Record<string, unknown> = {
        itemType: item.mark.itemType,
        readAt: Timestamp.fromDate(new Date(item.readAt)),
      };
      if (item.mark.itemType === "hadith") {
        docData.collection = item.mark.collection;
        docData.book = item.mark.book;
        docData.number = item.mark.number;
      } else {
        docData.surahId = item.mark.surahId;
      }
      batch.set(colRef.doc(item.readId), docData);
    }
    await batch.commit();
  }

  const summary = await rebuildSummary(uid);
  await summaryRef(db, uid).set(serializeSummary(summary));
  return { added: toAdd.length, summary };
}

async function rebuildSummary(uid: string): Promise<ReadsSummary> {
  const db = requireDb();
  const snap = await readsCol(db, uid).get();
  const records: Array<{ mark: ReadMark; readAt: string }> = [];
  for (const doc of snap.docs) {
    const mark = parseReadId(doc.id);
    if (!mark) continue;
    records.push({ mark, readAt: tsToIso(doc.get("readAt")) });
  }
  records.sort((a, b) => a.readAt.localeCompare(b.readAt));
  let s = emptyReadsSummary();
  for (const r of records) s = applyMark(s, r.mark, r.readAt);
  return s;
}
