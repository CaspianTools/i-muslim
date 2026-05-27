import type { NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { getApiCallerSession } from "@/lib/auth/session";
import { requireDb } from "@/lib/firebase/admin";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { writeApiAuditLog } from "@/lib/api/audit";
import { MAX_NOTE_LENGTH } from "@/types/notes";

export const runtime = "nodejs";

const NoteResourceSchema = z.enum(["quran", "hadith"]);

// Map mobile's {resource, ref} contract onto the existing web schema
// {itemType, itemId}. Web uses "ayah" for any Quran note (regardless of
// surah/ayah granularity); mobile sends "quran" with ref like "2:255". For
// hadith both sides line up on "hadith" with ref/itemId like "bukhari:1".
function resourceToItemType(resource: "quran" | "hadith"): "ayah" | "hadith" {
  return resource === "quran" ? "ayah" : "hadith";
}

/**
 * Synthesize a minimal NoteItemMeta from the resource + ref. The web
 * components that render the user's notes list expect at least a `title`
 * and `href` so the row can link back to source. Mobile doesn't send
 * itemMeta in v1 (the screen-rendering context isn't available inside the
 * outbox), so we generate something reasonable here.
 */
function synthesizeMeta(
  resource: "quran" | "hadith",
  ref: string,
): {
  title: string;
  subtitle: string | null;
  href: string;
  arabic: string | null;
  locale: string | null;
} {
  if (resource === "quran") {
    const [surah, ayah] = ref.split(":");
    return {
      title: `Ayah ${ref}`,
      subtitle: null,
      href: surah ? `/quran/${surah}${ayah ? `#ayah-${ayah}` : ""}` : "/quran",
      arabic: null,
      locale: null,
    };
  }
  const [collection, number] = ref.split(":");
  return {
    title: collection && number ? `${collection} #${number}` : ref,
    subtitle: null,
    href: collection && number ? `/hadith/${collection}/${number}` : "/hadith",
    arabic: null,
    locale: null,
  };
}

export async function OPTIONS() {
  return corsPreflight();
}

/* --------------------------------------------------------------------- */
/* GET /api/v1/me/notes?since=<iso>&limit=200                             */
/* --------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  const session = await getApiCallerSession(req);
  if (!session) {
    return withCors(apiError("UNAUTHENTICATED", "Sign-in required", 401));
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get("limit") ?? "200")),
    500,
  );
  const sinceTs =
    sinceParam && !Number.isNaN(Date.parse(sinceParam))
      ? Timestamp.fromDate(new Date(sinceParam))
      : null;

  const db = requireDb();
  let query: FirebaseFirestore.Query = db
    .collection("users")
    .doc(session.uid)
    .collection("notes")
    .orderBy("updatedAt", "desc")
    .limit(limit);
  if (sinceTs) {
    query = query.where("updatedAt", ">", sinceTs);
  }

  const snap = await query.get();
  const items = snap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      itemType: data.itemType,
      itemId: data.itemId,
      text: data.text,
      itemMeta: data.itemMeta,
      createdAt: tsToIso(data.createdAt),
      updatedAt: tsToIso(data.updatedAt ?? data.createdAt),
      deletedAt: data.deletedAt ? tsToIso(data.deletedAt) : null,
    };
  });

  return withCors(apiOk({ items, fetchedAt: new Date().toISOString() }));
}

/* --------------------------------------------------------------------- */
/* POST /api/v1/me/notes — upsert by mobile-supplied id                   */
/* --------------------------------------------------------------------- */

const UpsertSchema = z.object({
  id: z.string().min(1).max(64),
  resource: NoteResourceSchema,
  ref: z.string().min(1).max(64),
  body: z.string().max(MAX_NOTE_LENGTH),
  updatedAt: z.string().datetime().optional(),
  itemMeta: z
    .object({
      title: z.string().max(200).optional(),
      subtitle: z.string().max(200).nullable().optional(),
      href: z.string().max(400).optional(),
      arabic: z.string().max(2000).nullable().optional(),
      locale: z.string().max(16).nullable().optional(),
    })
    .optional(),
});

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

  const parsed = UpsertSchema.safeParse(json);
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
  const itemMeta = v.itemMeta
    ? { ...synthesizeMeta(v.resource, v.ref), ...v.itemMeta }
    : synthesizeMeta(v.resource, v.ref);

  const db = requireDb();
  const ref = db
    .collection("users")
    .doc(session.uid)
    .collection("notes")
    .doc(v.id);

  const before = await ref.get();
  const isNew = !before.exists;

  if (isNew) {
    await ref.set({
      itemType,
      itemId: v.ref,
      text: v.body,
      itemMeta,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deletedAt: null,
    });
  } else {
    await ref.set(
      {
        text: v.body,
        itemMeta,
        updatedAt: FieldValue.serverTimestamp(),
        deletedAt: null,
      },
      { merge: true },
    );
  }

  void writeApiAuditLog({
    actor: { kind: "admin", uid: session.uid, email: session.email },
    action: isNew ? "note.create" : "note.update",
    resourceType: "note",
    resourceId: v.id,
    after: { resource: v.resource, ref: v.ref, length: v.body.length },
  });

  return withCors(apiOk({ id: v.id, created: isNew }));
}

/* --------------------------------------------------------------------- */
/* DELETE /api/v1/me/notes — hard delete by mobile-supplied id            */
/* --------------------------------------------------------------------- */

const DeleteSchema = z.object({
  id: z.string().min(1).max(64),
  deletedAt: z.string().datetime().optional(),
});

export async function DELETE(req: NextRequest) {
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

  const parsed = DeleteSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(
      apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid input",
        400,
      ),
    );
  }

  const db = requireDb();
  const ref = db
    .collection("users")
    .doc(session.uid)
    .collection("notes")
    .doc(parsed.data.id);
  const snap = await ref.get();
  if (!snap.exists) {
    // Idempotent — treat missing as success.
    return withCors(apiOk({ id: parsed.data.id, deleted: false }));
  }
  await ref.delete();

  void writeApiAuditLog({
    actor: { kind: "admin", uid: session.uid, email: session.email },
    action: "note.delete",
    resourceType: "note",
    resourceId: parsed.data.id,
  });

  return withCors(apiOk({ id: parsed.data.id, deleted: true }));
}

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}
