"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { requireSiteSession } from "@/lib/auth/session";
import {
  COMMENTS_COLLECTION,
  COMMENT_STATS_COLLECTION,
  normalizeComment,
} from "@/lib/comments/data";
import {
  FLAG_AUTO_HIDE_THRESHOLD,
  MAX_COMMENT_LENGTH,
  commentStatsKey,
  isCommentEntityType,
  isReactionKind,
  type CommentEntityType,
  type CommentItemMeta,
  type CommentReactionCounts,
  type CommentReactionKind,
  type CommentRecord,
} from "@/types/comments";

type ActionFailure =
  | { ok: false; error: string; reason?: "unauthorized" | "empty" | "too_long" | "invalid" | "not_found" | "forbidden" };

export type CreateCommentResult =
  | { ok: true; comment: CommentRecord }
  | ActionFailure;

export type EditCommentResult =
  | { ok: true; comment: CommentRecord }
  | ActionFailure;

export type DeleteCommentResult = { ok: true } | ActionFailure;

export type SetReactionResult =
  | { ok: true; reactions: CommentReactionCounts; userKind: CommentReactionKind | null }
  | ActionFailure;

export type FlagCommentResult =
  | { ok: true; autoHidden: boolean }
  | ActionFailure;

// Cap the caller-supplied display metadata so it can't be used to bloat the
// comment doc (only the body is otherwise length-limited).
function sanitizeMeta(meta: CommentItemMeta): CommentItemMeta {
  return {
    title: (meta.title ?? "").slice(0, 200),
    subtitle: meta.subtitle ? meta.subtitle.slice(0, 200) : null,
    href: (meta.href ?? "").slice(0, 400),
    locale: meta.locale ? meta.locale.slice(0, 16) : null,
  };
}

// Only revalidate our own relative routes. Rejecting absolute / protocol-
// relative hrefs stops a caller from driving revalidation of an arbitrary path
// (cache-churn) via the itemMeta.href they control.
function isInAppPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

function revalidateForMeta(meta: CommentItemMeta) {
  if (meta.href && isInAppPath(meta.href)) revalidatePath(meta.href);
  revalidatePath("/profile/comments");
}

export interface CreateCommentInput {
  entityType: CommentEntityType;
  entityId: string;
  parentId: string | null;
  body: string;
  itemMeta: CommentItemMeta;
}

export async function createCommentAction(
  input: CreateCommentInput,
): Promise<CreateCommentResult> {
  if (!isCommentEntityType(input.entityType)) {
    return { ok: false, error: "Bad entity type", reason: "invalid" };
  }
  if (!input.entityId) {
    return { ok: false, error: "Bad entity id", reason: "invalid" };
  }
  const body = (input.body ?? "").trim();
  if (!body) return { ok: false, error: "Comment is empty", reason: "empty" };
  if (body.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: "Comment is too long", reason: "too_long" };
  }

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const itemMeta = sanitizeMeta(input.itemMeta);
  const newRef = db.collection(COMMENTS_COLLECTION).doc();
  const parentId = input.parentId ?? null;

  try {
    await db.runTransaction(async (tx) => {
      // If reply, verify parent exists and is itself top-level (we only allow one level).
      let rootId = newRef.id;
      if (parentId) {
        const parentRef = db.collection(COMMENTS_COLLECTION).doc(parentId);
        const parentSnap = await tx.get(parentRef);
        if (!parentSnap.exists) throw new Error("Parent comment not found");
        const parentData = parentSnap.data() ?? {};
        if (parentData.parentId) {
          throw new Error("Replies to replies are not allowed");
        }
        if (
          parentData.entityType !== input.entityType ||
          parentData.entityId !== input.entityId
        ) {
          throw new Error("Parent/entity mismatch");
        }
        rootId = parentId;
        tx.update(parentRef, {
          replyCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      tx.set(newRef, {
        entityType: input.entityType,
        entityId: input.entityId,
        parentId,
        rootId,
        body,
        author: {
          uid: session.uid,
          name: session.name ?? null,
          picture: session.picture ?? null,
        },
        reactions: { heart: 0, dua: 0, insightful: 0 },
        replyCount: 0,
        flagCount: 0,
        status: "visible",
        itemMeta,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        editedAt: null,
      });

      if (!parentId) {
        const statsRef = db
          .collection(COMMENT_STATS_COLLECTION)
          .doc(commentStatsKey(input.entityType, input.entityId));
        tx.set(
          statsRef,
          {
            count: FieldValue.increment(1),
            latestAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    });

    const fresh = await newRef.get();
    const comment = normalizeComment(fresh.id, fresh.data() as Record<string, unknown>);
    if (!comment) return { ok: false, error: "Created but failed to read back" };
    revalidateForMeta(itemMeta);
    return { ok: true, comment };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return { ok: false, error: message };
  }
}

export interface EditCommentInput {
  commentId: string;
  body: string;
}

export async function editCommentAction(
  input: EditCommentInput,
): Promise<EditCommentResult> {
  const { commentId } = input;
  if (!commentId) return { ok: false, error: "Missing id", reason: "invalid" };
  const body = (input.body ?? "").trim();
  if (!body) return { ok: false, error: "Comment is empty", reason: "empty" };
  if (body.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: "Comment is too long", reason: "too_long" };
  }

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const ref = db.collection(COMMENTS_COLLECTION).doc(commentId);

  try {
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: "Not found", reason: "not_found" };
    const data = snap.data() ?? {};
    const ownerUid = (data.author as { uid?: string } | undefined)?.uid;
    if (ownerUid !== session.uid) {
      return { ok: false, error: "Not your comment", reason: "forbidden" };
    }
    if (data.status === "deleted") {
      return { ok: false, error: "Cannot edit a deleted comment", reason: "forbidden" };
    }
    await ref.update({
      body,
      updatedAt: FieldValue.serverTimestamp(),
      editedAt: FieldValue.serverTimestamp(),
    });
    const fresh = await ref.get();
    const comment = normalizeComment(fresh.id, fresh.data() as Record<string, unknown>);
    if (!comment) return { ok: false, error: "Updated but failed to read back" };
    revalidateForMeta(comment.itemMeta);
    return { ok: true, comment };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return { ok: false, error: message };
  }
}

export async function deleteCommentAction(
  commentId: string,
): Promise<DeleteCommentResult> {
  if (!commentId) return { ok: false, error: "Missing id", reason: "invalid" };
  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const ref = db.collection(COMMENTS_COLLECTION).doc(commentId);

  try {
    let metaForRevalidate: CommentItemMeta | null = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Not found");
      const data = snap.data() ?? {};
      const ownerUid = (data.author as { uid?: string } | undefined)?.uid;
      if (ownerUid !== session.uid) throw new Error("Not your comment");
      if (data.status === "deleted") return;

      const wasVisibleTopLevel =
        data.status === "visible" && (data.parentId ?? null) === null;
      const parentId = (data.parentId ?? null) as string | null;
      const entityType = data.entityType as CommentEntityType | undefined;
      const entityId = data.entityId as string | undefined;
      metaForRevalidate = (data.itemMeta as CommentItemMeta) ?? null;

      tx.update(ref, {
        status: "deleted",
        body: "",
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (parentId) {
        const parentRef = db.collection(COMMENTS_COLLECTION).doc(parentId);
        tx.update(parentRef, { replyCount: FieldValue.increment(-1) });
      } else if (wasVisibleTopLevel && entityType && entityId) {
        const statsRef = db
          .collection(COMMENT_STATS_COLLECTION)
          .doc(commentStatsKey(entityType, entityId));
        tx.set(
          statsRef,
          { count: FieldValue.increment(-1) },
          { merge: true },
        );
      }
    });

    if (metaForRevalidate) revalidateForMeta(metaForRevalidate);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    if (message === "Not found") {
      return { ok: false, error: message, reason: "not_found" };
    }
    if (message === "Not your comment") {
      return { ok: false, error: message, reason: "forbidden" };
    }
    return { ok: false, error: message };
  }
}

export interface SetReactionInput {
  commentId: string;
  /** null clears the user's reaction. */
  kind: CommentReactionKind | null;
}

/**
 * Toggles or switches the signed-in user's reaction on a comment. Stores
 * one doc per user under comments/{id}/reactions/{uid} and keeps the
 * denormalized counts on the parent comment in sync inside one
 * transaction.
 */
export async function setReactionAction(
  input: SetReactionInput,
): Promise<SetReactionResult> {
  const { commentId, kind } = input;
  if (!commentId) return { ok: false, error: "Missing id", reason: "invalid" };
  if (kind !== null && !isReactionKind(kind)) {
    return { ok: false, error: "Bad reaction kind", reason: "invalid" };
  }

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const commentRef = db.collection(COMMENTS_COLLECTION).doc(commentId);
  const reactionRef = commentRef.collection("reactions").doc(session.uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const [commentSnap, reactionSnap] = await Promise.all([
        tx.get(commentRef),
        tx.get(reactionRef),
      ]);
      if (!commentSnap.exists) throw new Error("Not found");
      const data = commentSnap.data() ?? {};
      const counts: CommentReactionCounts = {
        heart: typeof data.reactions?.heart === "number" ? data.reactions.heart : 0,
        dua: typeof data.reactions?.dua === "number" ? data.reactions.dua : 0,
        insightful:
          typeof data.reactions?.insightful === "number" ? data.reactions.insightful : 0,
      };
      const prevKind = reactionSnap.exists
        ? (reactionSnap.data()?.kind as CommentReactionKind | undefined)
        : undefined;

      // Unchanged → no-op
      if ((prevKind ?? null) === kind) {
        return { reactions: counts, userKind: kind };
      }

      if (prevKind && counts[prevKind] > 0) counts[prevKind] -= 1;
      if (kind) counts[kind] += 1;

      if (kind === null) {
        tx.delete(reactionRef);
      } else {
        tx.set(reactionRef, {
          kind,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      tx.update(commentRef, {
        reactions: counts,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { reactions: counts, userKind: kind };
    });

    return { ok: true, reactions: result.reactions, userKind: result.userKind };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update reaction";
    return { ok: false, error: message };
  }
}

export interface FlagCommentInput {
  commentId: string;
  reason: string;
}

/**
 * Records a flag (deduped per user) and auto-hides the comment once it
 * reaches FLAG_AUTO_HIDE_THRESHOLD distinct flags. Self-flagging is
 * silently rejected.
 */
export async function flagCommentAction(
  input: FlagCommentInput,
): Promise<FlagCommentResult> {
  const { commentId } = input;
  const reason = (input.reason ?? "").trim().slice(0, 500);
  if (!commentId) return { ok: false, error: "Missing id", reason: "invalid" };

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const commentRef = db.collection(COMMENTS_COLLECTION).doc(commentId);
  const flagRef = commentRef.collection("flags").doc(session.uid);

  try {
    const result = await db.runTransaction(async (tx) => {
      const [commentSnap, flagSnap] = await Promise.all([
        tx.get(commentRef),
        tx.get(flagRef),
      ]);
      if (!commentSnap.exists) throw new Error("Not found");
      const data = commentSnap.data() ?? {};
      const ownerUid = (data.author as { uid?: string } | undefined)?.uid;
      if (ownerUid === session.uid) {
        // No-op for self-flag — pretend success without state change.
        return { autoHidden: data.status === "auto_hidden" };
      }
      if (flagSnap.exists) {
        // Already flagged by this user — no-op.
        return { autoHidden: data.status === "auto_hidden" };
      }

      const prevCount = typeof data.flagCount === "number" ? data.flagCount : 0;
      const nextCount = prevCount + 1;
      const updates: Record<string, unknown> = {
        flagCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };

      let autoHidden = data.status === "auto_hidden";
      if (
        nextCount >= FLAG_AUTO_HIDE_THRESHOLD &&
        data.status === "visible"
      ) {
        updates.status = "auto_hidden";
        autoHidden = true;
        const isTopLevel = (data.parentId ?? null) === null;
        if (isTopLevel) {
          const entityType = data.entityType as CommentEntityType | undefined;
          const entityId = data.entityId as string | undefined;
          if (entityType && entityId) {
            const statsRef = db
              .collection(COMMENT_STATS_COLLECTION)
              .doc(commentStatsKey(entityType, entityId));
            tx.set(
              statsRef,
              { count: FieldValue.increment(-1) },
              { merge: true },
            );
          }
        }
      }

      tx.set(flagRef, {
        reason,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(commentRef, updates);

      return { autoHidden };
    });

    revalidatePath("/admin/comments");
    return { ok: true, autoHidden: result.autoHidden };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to flag comment";
    return { ok: false, error: message };
  }
}
