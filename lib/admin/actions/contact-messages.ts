"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/allowlist";
import { CONTACT_MESSAGES_COLLECTION } from "@/lib/admin/data/contact-messages";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorizeAdmin() {
  const session = await requireAdminSession();
  if (!isAdminEmail(session.email)) throw new Error("Unauthorized");
  return session;
}

async function setStatus(
  id: string,
  status: "open" | "resolved",
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }
  try {
    await db.collection(CONTACT_MESSAGES_COLLECTION).doc(id).set(
      status === "resolved"
        ? {
            status,
            resolvedAt: FieldValue.serverTimestamp(),
            resolvedBy: session.email,
          }
        : {
            status,
            resolvedAt: FieldValue.delete(),
            resolvedBy: FieldValue.delete(),
          },
      { merge: true },
    );
    revalidatePath("/admin/contact");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to update message" };
  }
}

export async function markContactMessageResolvedAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return setStatus(id, "resolved");
}

export async function reopenContactMessageAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return setStatus(id, "open");
}

export async function deleteContactMessageAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured." };
  }
  try {
    await db.collection(CONTACT_MESSAGES_COLLECTION).doc(id).delete();
    revalidatePath("/admin/contact");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to delete message" };
  }
}
