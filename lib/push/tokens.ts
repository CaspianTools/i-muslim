import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";

export const PUSH_TOKENS_COLLECTION = "pushTokens";

/** Store an FCM web-push token for a user (doc id = token, which is globally unique). */
export async function savePushToken(uid: string, token: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .collection(PUSH_TOKENS_COLLECTION)
    .doc(token)
    .set({ uid, token, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deletePushToken(token: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.collection(PUSH_TOKENS_COLLECTION).doc(token).delete().catch(() => {});
}

/** Collect all push tokens belonging to the given uids (chunked 'in' queries). */
export async function getTokensForUids(uids: string[]): Promise<string[]> {
  const db = getDb();
  if (!db || uids.length === 0) return [];
  const tokens: string[] = [];
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    try {
      const snap = await db.collection(PUSH_TOKENS_COLLECTION).where("uid", "in", chunk).get();
      snap.docs.forEach((d) => {
        const t = d.data().token as string | undefined;
        if (t) tokens.push(t);
      });
    } catch (err) {
      console.warn("[push] token lookup failed:", err);
    }
  }
  return tokens;
}
