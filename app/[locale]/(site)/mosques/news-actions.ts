"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/permissions/server";
import { canManageMosque } from "@/lib/mosques/authz";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { NEWS_SUBCOLLECTION } from "@/lib/mosques/news";
import { sendPushToFollowers } from "@/lib/push/send";
import { MAX_NEWS_BODY_LENGTH } from "@/types/mosque-news";

export interface NewsActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function newsCol(db: FirebaseFirestore.Firestore, slug: string) {
  return db.collection(MOSQUES_COLLECTION).doc(slug).collection(NEWS_SUBCOLLECTION);
}

export async function createNewsPost(
  slug: string,
  input: { body: string; image?: { url: string; storagePath: string } | null },
): Promise<NewsActionResult> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };
  if (!(await canManageMosque(slug))) return { ok: false, error: "forbidden" };

  const body = input.body.trim();
  if (body.length < 1 || body.length > MAX_NEWS_BODY_LENGTH) {
    return { ok: false, error: "invalid_body" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const doc: Record<string, unknown> = {
    mosqueSlug: slug,
    body,
    authorUid: session.uid,
    status: "visible",
    likeCount: 0,
    commentCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (input.image?.url && input.image.storagePath) {
    doc.image = { url: input.image.url, storagePath: input.image.storagePath };
  }

  const ref = await newsCol(db, slug).add(doc);
  await db
    .collection(MOSQUES_COLLECTION)
    .doc(slug)
    .update({ newsCount: FieldValue.increment(1) })
    .catch(() => {});

  // Best-effort push to followers (no-op until FCM is configured + tokens exist).
  try {
    const mq = await db.collection(MOSQUES_COLLECTION).doc(slug).get();
    const m = mq.data() ?? {};
    await sendPushToFollowers(slug, m.shortCode as string | undefined, {
      title: (m.name as { en?: string } | undefined)?.en ?? "New masjid update",
      body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    });
  } catch {
    // never let push failures break posting
  }

  revalidatePath(`/mosques/${slug}`);
  return { ok: true, id: ref.id };
}

export async function deleteNewsPost(slug: string, postId: string): Promise<NewsActionResult> {
  if (!(await canManageMosque(slug))) return { ok: false, error: "forbidden" };
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  await newsCol(db, slug).doc(postId).delete();
  await db
    .collection(MOSQUES_COLLECTION)
    .doc(slug)
    .update({ newsCount: FieldValue.increment(-1) })
    .catch(() => {});
  revalidatePath(`/mosques/${slug}`);
  return { ok: true };
}

export async function likeNewsPost(
  slug: string,
  postId: string,
): Promise<{ ok: boolean; error?: string; liked?: boolean }> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const postRef = newsCol(db, slug).doc(postId);
  const likeRef = postRef.collection("likes").doc(session.uid);
  try {
    const liked = await db.runTransaction(async (tx) => {
      const [post, like] = await Promise.all([tx.get(postRef), tx.get(likeRef)]);
      if (!post.exists) throw new Error("not_found");
      if (like.exists) {
        tx.delete(likeRef);
        tx.update(postRef, { likeCount: FieldValue.increment(-1) });
        return false;
      }
      tx.set(likeRef, { uid: session.uid, createdAt: FieldValue.serverTimestamp() });
      tx.update(postRef, { likeCount: FieldValue.increment(1) });
      return true;
    });
    return { ok: true, liked };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** Admin take-down (decision #7). Hides a post without deleting it. */
export async function takeDownNewsPost(slug: string, postId: string): Promise<NewsActionResult> {
  await requirePermission("comments.moderate");
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  await newsCol(db, slug).doc(postId).update({
    status: "taken_down",
    updatedAt: Timestamp.fromDate(new Date()),
  });
  await db
    .collection(MOSQUES_COLLECTION)
    .doc(slug)
    .update({ newsCount: FieldValue.increment(-1) })
    .catch(() => {});
  revalidatePath(`/mosques/${slug}`);
  return { ok: true };
}
