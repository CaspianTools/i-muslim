"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requirePermission } from "@/lib/permissions/server";
import {
  COMMENTS_COLLECTION,
  COMMENT_STATS_COLLECTION,
} from "@/lib/comments/data";
import {
  commentStatsKey,
  isCommentStatus,
  type CommentStatus,
} from "@/types/comments";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorizeAdmin() {
  return await requirePermission("comments.moderate");
}

/**
 * Admin transitions a comment to a new status. Recomputes the public count
 * stat: a comment counts toward `commentStats.count` only when it's both
 * top-level (parentId === null) AND status === "visible".
 */
export async function setCommentStatusAction(
  commentId: string,
  status: CommentStatus,
): Promise<ActionResult<{ id: string; status: CommentStatus }>> {
  if (!commentId) return { ok: false, error: "Missing id" };
  if (!isCommentStatus(status)) return { ok: false, error: "Invalid status" };
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }

  const ref = db.collection(COMMENTS_COLLECTION).doc(commentId);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Comment not found");
      const data = snap.data() ?? {};
      const prevStatus = data.status as CommentStatus | undefined;
      const isTopLevel = (data.parentId ?? null) === null;
      const entityType = data.entityType as string | undefined;
      const entityId = data.entityId as string | undefined;

      const wasCounted = prevStatus === "visible" && isTopLevel;
      const willCount = status === "visible" && isTopLevel;

      tx.update(ref, {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (entityType && entityId && wasCounted !== willCount) {
        const statsRef = db
          .collection(COMMENT_STATS_COLLECTION)
          .doc(commentStatsKey(entityType as never, entityId));
        const delta = willCount ? 1 : -1;
        tx.set(
          statsRef,
          {
            count: FieldValue.increment(delta),
            latestAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    });
    revalidatePath("/admin/comments");
    return { ok: true, data: { id: commentId, status } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update comment";
    return { ok: false, error: message };
  }
}

/**
 * Clears all flags on a comment, resets flagCount to 0, and (if the comment
 * is currently auto_hidden) restores it to visible.
 */
export async function dismissFlagsAction(
  commentId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!commentId) return { ok: false, error: "Missing id" };
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }

  const ref = db.collection(COMMENTS_COLLECTION).doc(commentId);
  const flagsCol = ref.collection("flags");

  try {
    const flagsSnap = await flagsCol.get();
    // Batch deletes (commit in chunks of 400 to stay under Firestore's 500 limit)
    let batch = db.batch();
    let opCount = 0;
    for (const doc of flagsSnap.docs) {
      batch.delete(doc.ref);
      opCount += 1;
      if (opCount >= 400) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }
    if (opCount > 0) await batch.commit();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Comment not found");
      const data = snap.data() ?? {};
      const prevStatus = data.status as CommentStatus | undefined;
      const isTopLevel = (data.parentId ?? null) === null;
      const entityType = data.entityType as string | undefined;
      const entityId = data.entityId as string | undefined;

      const updates: Record<string, unknown> = {
        flagCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (prevStatus === "auto_hidden") {
        updates.status = "visible";
        if (isTopLevel && entityType && entityId) {
          const statsRef = db
            .collection(COMMENT_STATS_COLLECTION)
            .doc(commentStatsKey(entityType as never, entityId));
          tx.set(
            statsRef,
            {
              count: FieldValue.increment(1),
              latestAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      }
      tx.update(ref, updates);
    });

    revalidatePath("/admin/comments");
    return { ok: true, data: { id: commentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to dismiss flags";
    return { ok: false, error: message };
  }
}

/**
 * Hard delete (admin-only). Removes the comment, its reactions and flags
 * subcollections, and decrements the parent counter when applicable.
 */
export async function deleteCommentHardAction(
  commentId: string,
): Promise<ActionResult<{ id: string }>> {
  if (!commentId) return { ok: false, error: "Missing id" };
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }

  const ref = db.collection(COMMENTS_COLLECTION).doc(commentId);

  try {
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: "Comment not found" };
    const data = snap.data() ?? {};
    const wasVisibleTopLevel =
      data.status === "visible" && (data.parentId ?? null) === null;
    const entityType = data.entityType as string | undefined;
    const entityId = data.entityId as string | undefined;
    const parentId = (data.parentId ?? null) as string | null;

    // Delete subcollections in chunks
    const subCols: FirebaseFirestore.CollectionReference[] = [
      ref.collection("reactions"),
      ref.collection("flags"),
    ];
    for (const col of subCols) {
      const sub = await col.get();
      let batch = db.batch();
      let opCount = 0;
      for (const doc of sub.docs) {
        batch.delete(doc.ref);
        opCount += 1;
        if (opCount >= 400) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
    }

    await db.runTransaction(async (tx) => {
      tx.delete(ref);
      if (wasVisibleTopLevel && entityType && entityId) {
        const statsRef = db
          .collection(COMMENT_STATS_COLLECTION)
          .doc(commentStatsKey(entityType as never, entityId));
        tx.set(
          statsRef,
          { count: FieldValue.increment(-1) },
          { merge: true },
        );
      }
      if (parentId) {
        const parentRef = db.collection(COMMENTS_COLLECTION).doc(parentId);
        tx.update(parentRef, { replyCount: FieldValue.increment(-1) });
      }
    });

    revalidatePath("/admin/comments");
    return { ok: true, data: { id: commentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete comment";
    return { ok: false, error: message };
  }
}
