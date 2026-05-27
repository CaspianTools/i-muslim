"use server";

import { revalidatePath } from "next/cache";
import { requireSiteSession } from "@/lib/auth/session";
import { resetReads, toggleRead } from "@/lib/reads/data";
import type { ReadMark } from "@/types/reads";

export type ToggleReadResult =
  | { ok: true; marked: boolean; readAt: string }
  | { ok: false; error: string; reason?: "unauthorized" };

function validateMark(payload: unknown): ReadMark | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p.itemType === "surah" && typeof p.surahId === "number" && p.surahId >= 1) {
    return { itemType: "surah", surahId: p.surahId };
  }
  if (
    p.itemType === "hadith" &&
    typeof p.collection === "string" &&
    p.collection.length > 0 &&
    typeof p.book === "number" &&
    typeof p.number === "number"
  ) {
    return {
      itemType: "hadith",
      collection: p.collection,
      book: p.book,
      number: p.number,
    };
  }
  return null;
}

export async function toggleReadAction(
  payload: ReadMark,
): Promise<ToggleReadResult> {
  const mark = validateMark(payload);
  if (!mark) return { ok: false, error: "Bad payload" };

  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }

  try {
    const result = await toggleRead(session.uid, mark);
    revalidatePath("/profile/reading");
    return { ok: true, marked: result.marked, readAt: result.readAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Toggle failed";
    return { ok: false, error: message };
  }
}

export type ResetReadsResult =
  | { ok: true }
  | { ok: false; error: string; reason?: "unauthorized" };

export async function resetReadsAction(): Promise<ResetReadsResult> {
  let session;
  try {
    session = await requireSiteSession();
  } catch {
    return { ok: false, error: "Sign in required", reason: "unauthorized" };
  }
  try {
    await resetReads(session.uid);
    revalidatePath("/profile/reading");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed";
    return { ok: false, error: message };
  }
}
