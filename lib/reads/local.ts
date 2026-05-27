import {
  emptyReadsSummary,
  type ReadMark,
  type ReadsSummary,
  type SerializedReadMark,
} from "@/types/reads";
import { parseReadId, readIdFromMark } from "@/lib/reads/ids";

export const LOCAL_READS_KEY = "i-muslim:reads:v1";
export const LOCAL_READS_EVENT = "i-muslim:reads:change";

interface LocalReadsPayload {
  version: 1;
  items: Record<string, { readAt: string }>;
}

function emptyPayload(): LocalReadsPayload {
  return { version: 1, items: {} };
}

function read(): LocalReadsPayload {
  if (typeof window === "undefined") return emptyPayload();
  try {
    const raw = window.localStorage.getItem(LOCAL_READS_KEY);
    if (!raw) return emptyPayload();
    const parsed = JSON.parse(raw) as Partial<LocalReadsPayload>;
    if (parsed.version !== 1 || !parsed.items || typeof parsed.items !== "object") {
      return emptyPayload();
    }
    const items: Record<string, { readAt: string }> = {};
    for (const [k, v] of Object.entries(parsed.items)) {
      if (v && typeof (v as { readAt?: unknown }).readAt === "string") {
        items[k] = { readAt: (v as { readAt: string }).readAt };
      }
    }
    return { version: 1, items };
  } catch {
    return emptyPayload();
  }
}

function write(payload: LocalReadsPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_READS_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event(LOCAL_READS_EVENT));
  } catch {
    // ignore quota errors
  }
}

export function getLocalReadIds(): Set<string> {
  return new Set(Object.keys(read().items));
}

export function getLocalReadSet(itemType: "hadith" | "surah"): Set<string> {
  const all = read().items;
  const set = new Set<string>();
  for (const id of Object.keys(all)) {
    const mark = parseReadId(id);
    if (mark && mark.itemType === itemType) set.add(id);
  }
  return set;
}

export function hasLocalRead(readId: string): boolean {
  return Object.prototype.hasOwnProperty.call(read().items, readId);
}

export interface ToggleLocalReadResult {
  marked: boolean;
  readAt: string;
}

export function toggleLocalRead(mark: ReadMark): ToggleLocalReadResult {
  const readId = readIdFromMark(mark);
  const payload = read();
  if (payload.items[readId]) {
    delete payload.items[readId];
    write(payload);
    return { marked: false, readAt: new Date().toISOString() };
  }
  const readAt = new Date().toISOString();
  payload.items[readId] = { readAt };
  write(payload);
  return { marked: true, readAt };
}

export function resetLocalReads(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_READS_KEY);
    window.dispatchEvent(new Event(LOCAL_READS_EVENT));
  } catch {
    // ignore
  }
}

export function exportLocalReads(): SerializedReadMark[] {
  const items = read().items;
  const out: SerializedReadMark[] = [];
  for (const [readId, val] of Object.entries(items)) {
    const mark = parseReadId(readId);
    if (!mark) continue;
    out.push({ readId, mark, readAt: val.readAt });
  }
  return out;
}

export function computeLocalSummary(): ReadsSummary {
  const records = exportLocalReads();
  records.sort((a, b) => a.readAt.localeCompare(b.readAt));
  let s = emptyReadsSummary();
  for (const r of records) s = applyMarkLocal(s, r.mark, r.readAt);
  return s;
}

function applyMarkLocal(
  s: ReadsSummary,
  mark: ReadMark,
  atIso: string,
): ReadsSummary {
  if (mark.itemType === "surah") {
    const prev = s.quran.latest;
    const latest =
      !prev || prev.at <= atIso ? { surahId: mark.surahId, at: atIso } : prev;
    return {
      ...s,
      quran: { surahsRead: s.quran.surahsRead + 1, latest },
      updatedAt: atIso,
    };
  }
  const slug = mark.collection;
  const existing = s.hadith.byCollection[slug] ?? { total: 0, byBook: {} };
  const bookKey = String(mark.book);
  const colPrev = existing.latest;
  const colLatest =
    !colPrev || colPrev.at <= atIso
      ? { book: mark.book, number: mark.number, at: atIso }
      : colPrev;
  const newCol = {
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
