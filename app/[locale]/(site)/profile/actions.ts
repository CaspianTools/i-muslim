"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, requireDb } from "@/lib/firebase/admin";
import { requireSiteSession } from "@/lib/auth/session";
import {
  inputToRecord,
  profileFieldsSchema,
  type ProfileFieldsInput,
} from "@/lib/profile/schema";
import { ageFromDob } from "@/lib/matrimonial/age";
import {
  type FavoriteItemMeta,
  type FavoriteItemType,
  isFavoriteItemType,
} from "@/types/profile";
import {
  FAVORITE_STATS_COLLECTION,
  favoriteStatsKey,
} from "@/lib/profile/favoriteStats";

export type SaveProfileFieldsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveProfileFieldsAction(
  input: ProfileFieldsInput,
): Promise<SaveProfileFieldsResult> {
  const session = await requireSiteSession();
  const parsed = profileFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile" };
  }
  const v = parsed.data;
  if (ageFromDob(v.dateOfBirth) < 18) {
    return { ok: false, error: "Must be at least 18." };
  }
  const db = requireDb();
  const record = inputToRecord(v);
  await db
    .collection("users")
    .doc(session.uid)
    .set(
      {
        profile: { ...record, updatedAt: FieldValue.serverTimestamp() },
        // Mirror displayName at the top level so admin lists pick it up.
        displayName: record.displayName,
        lastActiveAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  // If the user has an active matrimonial profile, mirror displayName there
  // so /matrimonial/browse stays consistent.
  try {
    const matSnap = await db.collection("matrimonialProfiles").doc(session.uid).get();
    if (matSnap.exists) {
      await matSnap.ref.set(
        { displayName: record.displayName, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    }
  } catch (err) {
    console.warn("[profile/actions] mirror displayName to matrimonial failed:", err);
  }

  revalidatePath("/profile");
  revalidatePath("/profile/matrimonial");
  revalidatePath("/matrimonial");
  return { ok: true };
}

export type ToggleFavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; error: string; reason?: "unauthorized" };

export async function toggleFavoriteAction(payload: {
  itemType: FavoriteItemType;
  itemId: string;
  itemMeta: FavoriteItemMeta;
}): Promise<ToggleFavoriteResult> {
  if (!isFavoriteItemType(payload.itemType)) return { ok: false, error: "Bad item type" };
  if (!payload.itemId) return { ok: false, error: "Bad item id" };

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const col = db.collection("users").doc(session.uid).collection("favorites");
  const statsRef = db
    .collection(FAVORITE_STATS_COLLECTION)
    .doc(favoriteStatsKey(payload.itemType, payload.itemId));

  try {
    const existing = await col
      .where("itemType", "==", payload.itemType)
      .where("itemId", "==", payload.itemId)
      .limit(1)
      .get();

    if (!existing.empty) {
      await existing.docs[0]!.ref.delete();
      try {
        await statsRef.set(
          {
            itemType: payload.itemType,
            itemId: payload.itemId,
            count: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.warn("[profile/actions] favoriteStats decrement failed:", err);
      }
      revalidatePath("/profile/favorites");
      return { ok: true, favorited: false };
    }

    await col.add({
      itemType: payload.itemType,
      itemId: payload.itemId,
      itemMeta: {
        title: payload.itemMeta.title,
        subtitle: payload.itemMeta.subtitle ?? null,
        href: payload.itemMeta.href,
        thumbnail: payload.itemMeta.thumbnail ?? null,
        arabic: payload.itemMeta.arabic ?? null,
        locale: payload.itemMeta.locale ?? null,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    try {
      await statsRef.set(
        {
          itemType: payload.itemType,
          itemId: payload.itemId,
          count: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.warn("[profile/actions] favoriteStats increment failed:", err);
    }
    revalidatePath("/profile/favorites");
    return { ok: true, favorited: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Toggle failed";
    return { ok: false, error: message };
  }
}

export type RemoveFavoriteResult =
  | { ok: true }
  | { ok: false; error: string; reason?: "unauthorized" };

export async function removeFavoriteAction(
  favoriteId: string,
): Promise<RemoveFavoriteResult> {
  if (!favoriteId) return { ok: false, error: "Missing favorite id" };

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  try {
    const ref = db
      .collection("users")
      .doc(session.uid)
      .collection("favorites")
      .doc(favoriteId);
    const snap = await ref.get();
    if (!snap.exists) {
      revalidatePath("/profile/favorites");
      return { ok: true };
    }
    const data = snap.data() ?? {};
    const itemType = data.itemType;
    const itemId = data.itemId;
    await ref.delete();
    if (isFavoriteItemType(itemType) && typeof itemId === "string" && itemId) {
      try {
        await db
          .collection(FAVORITE_STATS_COLLECTION)
          .doc(favoriteStatsKey(itemType, itemId))
          .set(
            {
              itemType,
              itemId,
              count: FieldValue.increment(-1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      } catch (err) {
        console.warn("[profile/actions] favoriteStats decrement failed:", err);
      }
    }
    revalidatePath("/profile/favorites");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Remove failed";
    return { ok: false, error: message };
  }
}
