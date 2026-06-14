import "server-only";
import { getDb } from "@/lib/firebase/admin";
import type {
  ContentFlag,
  ContentFlagItemType,
  ContentFlagStatus,
} from "@/types/content-flag";

export const CONTENT_FLAGS_COLLECTION = "contentFlags";

const ITEM_TYPES: ContentFlagItemType[] = ["hadith", "ayah"];
const STATUSES: ContentFlagStatus[] = ["open", "resolved", "dismissed"];

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === "object" &&
    v &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function asOptionalIso(v: unknown): string | undefined {
  if (!v) return undefined;
  return asIso(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function normalizeContentFlag(
  id: string,
  raw: Record<string, unknown>,
): ContentFlag | null {
  if (!raw) return null;
  const itemId = asString(raw.itemId);
  if (!itemId) return null;

  const itemTypeRaw = typeof raw.itemType === "string" ? raw.itemType : "hadith";
  const itemType: ContentFlagItemType = ITEM_TYPES.includes(
    itemTypeRaw as ContentFlagItemType,
  )
    ? (itemTypeRaw as ContentFlagItemType)
    : "hadith";

  const statusRaw = typeof raw.status === "string" ? raw.status : "open";
  const status: ContentFlagStatus = STATUSES.includes(statusRaw as ContentFlagStatus)
    ? (statusRaw as ContentFlagStatus)
    : "open";

  return {
    id,
    itemType,
    itemId,
    reference: asString(raw.reference, itemId),
    href: asString(raw.href),
    locale: asString(raw.locale),
    note: asString(raw.note),
    reporterUid: asString(raw.reporterUid),
    reporterEmail: asOptionalString(raw.reporterEmail) ?? null,
    status,
    createdAt: asIso(raw.createdAt),
    resolvedAt: asOptionalIso(raw.resolvedAt),
    resolvedBy: asOptionalString(raw.resolvedBy),
  };
}

export type ContentFlagsResult = {
  flags: ContentFlag[];
  source: "firestore" | "unavailable";
};

export async function fetchContentFlags(): Promise<ContentFlagsResult> {
  const db = getDb();
  if (!db) return { flags: [], source: "unavailable" };
  try {
    const snap = await db
      .collection(CONTENT_FLAGS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const flags = snap.docs
      .map((d) => normalizeContentFlag(d.id, d.data() as Record<string, unknown>))
      .filter((f): f is ContentFlag => f !== null);
    return { flags, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/content-flags] read failed:", err);
    return { flags: [], source: "unavailable" };
  }
}

export async function countOpenContentFlags(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const snap = await db
      .collection(CONTENT_FLAGS_COLLECTION)
      .where("status", "==", "open")
      .count()
      .get();
    return snap.data().count;
  } catch (err) {
    console.warn("[admin/data/content-flags] count failed:", err);
    return 0;
  }
}
