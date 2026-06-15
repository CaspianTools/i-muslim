import "server-only";
import { getDb } from "@/lib/firebase/admin";
import type { Timestamp } from "firebase-admin/firestore";
import type {
  MosqueApplication,
  MosqueApplicationStatus,
} from "@/types/mosque-application";

export const MOSQUE_APPLICATIONS_COLLECTION = "mosqueApplications";

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "toDate" in v && typeof (v as Timestamp).toDate === "function") {
    return (v as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

export function normalizeApplication(
  id: string,
  raw: Record<string, unknown>,
): MosqueApplication | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = raw.kind === "register" ? "register" : "claim";
  const applicant = raw.applicant as MosqueApplication["applicant"] | undefined;
  const proofDoc = raw.proofDoc as MosqueApplication["proofDoc"] | undefined;
  if (!applicant?.uid || !proofDoc?.storagePath) return null;
  return {
    id,
    kind,
    mosqueSlug: raw.mosqueSlug as string | undefined,
    proposedMosque: raw.proposedMosque as MosqueApplication["proposedMosque"],
    applicant,
    proofDoc,
    message: raw.message as string | undefined,
    status: (raw.status as MosqueApplicationStatus) ?? "pending",
    reviewedBy: raw.reviewedBy as string | undefined,
    reviewedAt: raw.reviewedAt ? asIso(raw.reviewedAt) : undefined,
    rejectionReason: raw.rejectionReason as string | undefined,
    createdMosqueSlug: raw.createdMosqueSlug as string | undefined,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
  };
}

export async function listMosqueApplications(
  status: MosqueApplicationStatus = "pending",
): Promise<MosqueApplication[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection(MOSQUE_APPLICATIONS_COLLECTION)
      .where("status", "==", status)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return snap.docs
      .map((d) => normalizeApplication(d.id, d.data() as Record<string, unknown>))
      .filter((a): a is MosqueApplication => a !== null);
  } catch (err) {
    console.warn("[mosqueApplications] list failed:", err);
    return [];
  }
}

export async function getMosqueApplication(id: string): Promise<MosqueApplication | null> {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection(MOSQUE_APPLICATIONS_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return normalizeApplication(doc.id, doc.data() as Record<string, unknown>);
}

export async function countPendingMosqueApplications(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const snap = await db
      .collection(MOSQUE_APPLICATIONS_COLLECTION)
      .where("status", "==", "pending")
      .count()
      .get();
    return snap.data().count;
  } catch {
    return 0;
  }
}

/** Has this user already applied (pending) for this mosque? Used to avoid dupes. */
export async function hasPendingApplicationFor(
  uid: string,
  mosqueSlug: string,
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const snap = await db
      .collection(MOSQUE_APPLICATIONS_COLLECTION)
      .where("applicant.uid", "==", uid)
      .where("mosqueSlug", "==", mosqueSlug)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    return false;
  }
}
