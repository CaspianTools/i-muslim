import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";

// Lifetime counters live in a single well-known doc per mosque. View rates for a
// masjid page are low, so the single-doc write ceiling (~1/sec) is comfortable;
// shard if a masjid ever sustains heavy traffic.
const ANALYTICS_SUBCOLLECTION = "analytics";
const TOTALS_DOC = "totals";

export interface MosqueAnalytics {
  views: number;
  scans: number;
}

function totalsRef(slug: string) {
  const db = getDb();
  if (!db) return null;
  return db.collection(MOSQUES_COLLECTION).doc(slug).collection(ANALYTICS_SUBCOLLECTION).doc(TOTALS_DOC);
}

/** Increment the lifetime view counter (and scan counter when the visit came from a QR code). */
export async function recordMosqueView(slug: string, scan: boolean): Promise<void> {
  const ref = totalsRef(slug);
  if (!ref) return;
  try {
    await ref.set(
      {
        views: FieldValue.increment(1),
        ...(scan ? { scans: FieldValue.increment(1) } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("[mosques/analytics] record failed:", err);
  }
}

export async function getMosqueAnalytics(slug: string): Promise<MosqueAnalytics> {
  const ref = totalsRef(slug);
  if (!ref) return { views: 0, scans: 0 };
  try {
    const snap = await ref.get();
    const data = snap.data() ?? {};
    return {
      views: typeof data.views === "number" ? data.views : 0,
      scans: typeof data.scans === "number" ? data.scans : 0,
    };
  } catch {
    return { views: 0, scans: 0 };
  }
}
