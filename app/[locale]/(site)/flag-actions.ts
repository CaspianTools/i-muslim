"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { requireSiteSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/admin/data/notifications";
import { CONTENT_FLAGS_COLLECTION } from "@/lib/admin/data/content-flags";
import type { ContentFlagItemType } from "@/types/content-flag";

export interface FlagContentInput {
  itemType: ContentFlagItemType;
  itemId: string;
  reference: string;
  href: string;
  locale: string;
  note: string;
}

export type FlagContentResult =
  | { ok: true; alreadyFlagged: boolean }
  | { ok: false; error: string; reason?: "unauthorized" | "invalid" };

// Firestore doc ids can't contain "/" — hadith ids carry slashes and ayah ids
// carry colons, so flatten both to "_" for a deterministic, dedup-friendly id.
function flagDocId(itemType: ContentFlagItemType, itemId: string, uid: string): string {
  const safeItem = itemId.replace(/[/:]/g, "_");
  return `${itemType}__${safeItem}__${uid}`;
}

/**
 * Records a content-quality report for a hadith or ayah, deduped one-per-user
 * per item (deterministic doc id). A newly-created flag fires a single admin
 * notification; re-flagging the same item is a silent no-op.
 */
export async function flagContentAction(
  input: FlagContentInput,
): Promise<FlagContentResult> {
  const { itemType, itemId, reference, href, locale } = input;
  const note = (input.note ?? "").trim().slice(0, 500);
  if (itemType !== "hadith" && itemType !== "ayah") {
    return { ok: false, error: "Invalid item type", reason: "invalid" };
  }
  if (!itemId || !reference) {
    return { ok: false, error: "Missing item", reason: "invalid" };
  }

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const flagRef = db
    .collection(CONTENT_FLAGS_COLLECTION)
    .doc(flagDocId(itemType, itemId, session.uid));

  try {
    const created = await db.runTransaction(async (tx) => {
      const snap = await tx.get(flagRef);
      if (snap.exists) return false; // already flagged by this user — no-op
      tx.set(flagRef, {
        itemType,
        itemId,
        reference,
        href,
        locale,
        note,
        reporterUid: session.uid,
        reporterEmail: session.email ?? null,
        status: "open",
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (created) {
      await createNotification({
        type: "flagged",
        title: reference,
        body: note || "(no note provided)",
        link: "/admin/flags",
        sourceCollection: CONTENT_FLAGS_COLLECTION,
        sourceId: flagRef.id,
      });
      revalidatePath("/admin/flags");
    }

    return { ok: true, alreadyFlagged: !created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit report";
    return { ok: false, error: message };
  }
}
