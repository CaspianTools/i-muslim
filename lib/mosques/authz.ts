import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { hasPermission } from "@/lib/permissions/check";
import { getSiteSession } from "@/lib/auth/session";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";

/**
 * True when the current site session is allowed to manage `mosqueSlug`:
 *   1. caller has the global `mosques.write` permission (site admin), or
 *   2. caller's uid appears in `mosques/{mosqueSlug}.managers[]`
 *      (assigned by admins after off-platform identity verification).
 *
 * Used by the event create/update server actions, the public submit API, and
 * the mosque page render to gate the "Add event" CTA.
 */
export async function canManageMosque(mosqueSlug: string): Promise<boolean> {
  if (!mosqueSlug) return false;
  const session = await getSiteSession();
  if (!session) return false;
  if (hasPermission(session.permissions, "mosques.write")) return true;
  const db = getDb();
  if (!db) return false;
  const snap = await db.collection(MOSQUES_COLLECTION).doc(mosqueSlug).get();
  if (!snap.exists) return false;
  const managers = snap.data()?.managers;
  if (!Array.isArray(managers)) return false;
  return managers.includes(session.uid);
}
