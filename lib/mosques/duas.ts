import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import type { Timestamp } from "firebase-admin/firestore";

export const DUAS_SUBCOLLECTION = "duas";
export const MAX_DUA_LENGTH = 280;

export type MosqueDuaStatus = "visible" | "taken_down";

/** A community du'a (prayer) request on a masjid's Du'a Wall. */
export interface MosqueDua {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  madeDuaCount: number;
  status: MosqueDuaStatus;
  createdAt: string;
}

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "toDate" in v && typeof (v as Timestamp).toDate === "function") {
    return (v as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

export function normalizeDua(id: string, raw: Record<string, unknown>): MosqueDua | null {
  if (!raw || typeof raw !== "object") return null;
  const text = typeof raw.text === "string" ? raw.text : "";
  if (!text) return null;
  return {
    id,
    text,
    authorUid: (raw.authorUid as string) ?? "",
    authorName: (raw.authorName as string) ?? "",
    madeDuaCount: typeof raw.madeDuaCount === "number" ? raw.madeDuaCount : 0,
    status: (raw.status as MosqueDuaStatus) ?? "visible",
    createdAt: asIso(raw.createdAt),
  };
}

export async function listMosqueDuas(
  slug: string,
  opts: { limit?: number } = {},
): Promise<MosqueDua[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection(MOSQUES_COLLECTION)
      .doc(slug)
      .collection(DUAS_SUBCOLLECTION)
      .where("status", "==", "visible")
      .orderBy("createdAt", "desc")
      .limit(opts.limit ?? 12)
      .get();
    return snap.docs
      .map((d) => normalizeDua(d.id, d.data() as Record<string, unknown>))
      .filter((d): d is MosqueDua => d !== null);
  } catch (err) {
    console.warn("[mosques/duas] list failed:", err);
    return [];
  }
}

/** Which of these du'as the given user has already "made du'a" for. */
export async function getMyAminDuaIds(
  slug: string,
  uid: string,
  duaIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  if (!uid || duaIds.length === 0) return out;
  const db = getDb();
  if (!db) return out;
  const col = db.collection(MOSQUES_COLLECTION).doc(slug).collection(DUAS_SUBCOLLECTION);
  try {
    const refs = duaIds.map((id) => col.doc(id).collection("amins").doc(uid));
    const snaps = await db.getAll(...refs);
    snaps.forEach((snap, idx) => {
      if (snap.exists) out.add(duaIds[idx]!);
    });
  } catch (err) {
    console.warn("[mosques/duas] amin read failed:", err);
  }
  return out;
}
