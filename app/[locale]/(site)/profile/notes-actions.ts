"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { requireSiteSession } from "@/lib/auth/session";
import {
  MAX_NOTE_LENGTH,
  isNoteItemType,
  type NoteItemMeta,
  type NoteItemType,
  type NoteRecord,
} from "@/types/notes";

export type UpsertNoteResult =
  | { ok: true; note: NoteRecord }
  | {
      ok: false;
      error: string;
      reason?: "unauthorized" | "empty" | "too_long" | "invalid";
    };

export type DeleteNoteResult =
  | { ok: true }
  | { ok: false; error: string; reason?: "unauthorized" };

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

// Cap the caller-supplied display metadata so it can't bloat the note doc
// (only `text` is otherwise length-limited).
function sanitizeMeta(meta: NoteItemMeta): NoteItemMeta {
  return {
    title: (meta.title ?? "").slice(0, 200),
    subtitle: meta.subtitle ? meta.subtitle.slice(0, 200) : null,
    href: (meta.href ?? "").slice(0, 400),
    arabic: meta.arabic ? meta.arabic.slice(0, 2000) : null,
    locale: meta.locale ? meta.locale.slice(0, 16) : null,
  };
}

export async function upsertNoteAction(payload: {
  itemType: NoteItemType;
  itemId: string;
  itemMeta: NoteItemMeta;
  text: string;
}): Promise<UpsertNoteResult> {
  if (!isNoteItemType(payload.itemType)) {
    return { ok: false, error: "Bad item type", reason: "invalid" };
  }
  if (!payload.itemId) {
    return { ok: false, error: "Bad item id", reason: "invalid" };
  }
  const text = (payload.text ?? "").trim();
  if (!text) {
    return { ok: false, error: "Note is empty", reason: "empty" };
  }
  if (text.length > MAX_NOTE_LENGTH) {
    return { ok: false, error: "Note is too long", reason: "too_long" };
  }

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  const col = db.collection("users").doc(session.uid).collection("notes");
  const itemMeta = sanitizeMeta(payload.itemMeta);

  try {
    const existing = await col
      .where("itemType", "==", payload.itemType)
      .where("itemId", "==", payload.itemId)
      .limit(1)
      .get();

    if (!existing.empty) {
      const ref = existing.docs[0]!.ref;
      await ref.update({
        text,
        itemMeta,
        updatedAt: FieldValue.serverTimestamp(),
      });
      const fresh = await ref.get();
      const data = fresh.data() as Record<string, unknown>;
      revalidatePath("/profile/notes");
      return {
        ok: true,
        note: {
          id: ref.id,
          itemType: payload.itemType,
          itemId: payload.itemId,
          text,
          itemMeta,
          createdAt: tsToIso(data.createdAt),
          updatedAt: tsToIso(data.updatedAt),
        },
      };
    }

    const now = FieldValue.serverTimestamp();
    const ref = await col.add({
      itemType: payload.itemType,
      itemId: payload.itemId,
      text,
      itemMeta,
      createdAt: now,
      updatedAt: now,
    });
    const fresh = await ref.get();
    const data = fresh.data() as Record<string, unknown>;
    revalidatePath("/profile/notes");
    return {
      ok: true,
      note: {
        id: ref.id,
        itemType: payload.itemType,
        itemId: payload.itemId,
        text,
        itemMeta,
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt ?? data.createdAt),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return { ok: false, error: message };
  }
}

export async function deleteNoteAction(noteId: string): Promise<DeleteNoteResult> {
  if (!noteId) return { ok: false, error: "Missing note id" };

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  const db = getDb();
  if (!db) return { ok: false, error: "Firebase is not configured" };

  try {
    await db
      .collection("users")
      .doc(session.uid)
      .collection("notes")
      .doc(noteId)
      .delete();
    revalidatePath("/profile/notes");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return { ok: false, error: message };
  }
}
