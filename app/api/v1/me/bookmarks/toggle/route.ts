import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { writeApiAuditLog } from "@/lib/api/audit";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { getApiCallerSession } from "@/lib/auth/session";
import { requireDb } from "@/lib/firebase/admin";
import {
  FAVORITE_STATS_COLLECTION,
  favoriteStatsKey,
} from "@/lib/profile/favoriteStats";

export const runtime = "nodejs";

const ToggleSchema = z.object({
  resource: z.enum(["quran", "hadith"]),
  ref: z.string().min(1).max(64),
});

function resourceToItemType(resource: "quran" | "hadith"): "ayah" | "hadith" {
  return resource === "quran" ? "ayah" : "hadith";
}

function synthesizeMeta(resource: "quran" | "hadith", ref: string) {
  if (resource === "quran") {
    const [surah, ayah] = ref.split(":");
    return {
      title: `Ayah ${ref}`,
      subtitle: null,
      href: surah ? `/quran/${surah}${ayah ? `#ayah-${ayah}` : ""}` : "/quran",
      thumbnail: null,
      arabic: null,
      locale: null,
    };
  }
  const [collection, number] = ref.split(":");
  return {
    title: collection && number ? `${collection} #${number}` : ref,
    subtitle: null,
    href: collection && number ? `/hadith/${collection}/${number}` : "/hadith",
    thumbnail: null,
    arabic: null,
    locale: null,
  };
}

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * POST /api/v1/me/bookmarks/toggle
 * Body: { resource: "quran" | "hadith", ref: string }
 *
 * Mirrors the web's `toggleFavoriteAction` ([app/[locale]/(site)/profile/actions.ts]):
 * looks up an existing favorite by (itemType, itemId), deletes it if found,
 * otherwise creates one — and increments/decrements the public-read
 * `favoriteStats/{itemType}__{itemId}` aggregate either way.
 */
export async function POST(req: NextRequest) {
  const session = await getApiCallerSession(req);
  if (!session) {
    return withCors(apiError("UNAUTHENTICATED", "Sign-in required", 401));
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return withCors(apiError("INVALID_JSON", "Request body must be JSON", 400));
  }

  const parsed = ToggleSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(
      apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid input",
        400,
      ),
    );
  }
  const v = parsed.data;
  const itemType = resourceToItemType(v.resource);
  const itemMeta = synthesizeMeta(v.resource, v.ref);

  const db = requireDb();
  const col = db.collection("users").doc(session.uid).collection("favorites");
  const statsRef = db
    .collection(FAVORITE_STATS_COLLECTION)
    .doc(favoriteStatsKey(itemType, v.ref));

  const existing = await col
    .where("itemType", "==", itemType)
    .where("itemId", "==", v.ref)
    .limit(1)
    .get();

  if (!existing.empty) {
    await existing.docs[0]!.ref.delete();
    void statsRef
      .set(
        {
          itemType,
          itemId: v.ref,
          count: FieldValue.increment(-1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch((err) => {
        console.warn("[api/v1/me/bookmarks/toggle] decrement failed:", err);
      });
    void writeApiAuditLog({
      actor: { kind: "admin", uid: session.uid, email: session.email },
      action: "favorite.remove",
      resourceType: itemType,
      resourceId: v.ref,
    });
    return withCors(apiOk({ favorited: false }));
  }

  await col.add({
    itemType,
    itemId: v.ref,
    itemMeta,
    createdAt: FieldValue.serverTimestamp(),
  });
  void statsRef
    .set(
      {
        itemType,
        itemId: v.ref,
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    .catch((err) => {
      console.warn("[api/v1/me/bookmarks/toggle] increment failed:", err);
    });
  void writeApiAuditLog({
    actor: { kind: "admin", uid: session.uid, email: session.email },
    action: "favorite.add",
    resourceType: itemType,
    resourceId: v.ref,
  });
  return withCors(apiOk({ favorited: true }));
}
