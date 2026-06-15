"use server";

import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import {
  createMosqueUploadUrl,
  publicUrlFor,
  type MosqueUploadUrlResult,
} from "@/lib/mosques/storage";
import {
  mosqueApplicationSchema,
  type MosqueApplicationInput,
} from "@/lib/mosques/apply-schema";
import {
  MOSQUE_APPLICATIONS_COLLECTION,
  hasPendingApplicationFor,
} from "@/lib/mosques/applications";
import { fetchMosqueBySlug } from "@/lib/admin/data/mosques";
import { createNotification } from "@/lib/admin/data/notifications";

export interface ApplyActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const MAX_PENDING_PER_USER = 3;

/**
 * Mint a signed upload URL for a proof-of-authorization document. Unlike the
 * admin upload action this requires ONLY a signed-in session — applicants don't
 * have `mosques.write`. The proof lands under a private `proof/` folder.
 */
export async function getApplicationUploadUrlAction(input: {
  kind: "claim" | "register";
  mosqueSlug?: string;
  filename: string;
  contentType: string;
  contentLength: number;
}): Promise<{ ok: boolean; error?: string; result?: MosqueUploadUrlResult & { publicUrl: string } }> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };
  // Namespace register-proofs by uid (the mosque slug doesn't exist yet).
  const slug =
    input.kind === "claim" && input.mosqueSlug
      ? input.mosqueSlug
      : `pending-${session.uid}`;
  try {
    const result = await createMosqueUploadUrl({
      slug,
      kind: "proof",
      filename: input.filename,
      contentType: input.contentType,
      contentLength: input.contentLength,
    });
    return { ok: true, result: { ...result, publicUrl: publicUrlFor(result.storagePath) } };
  } catch (err) {
    console.warn("[mosques/apply] upload url failed:", err);
    return { ok: false, error: "upload_url_failed" };
  }
}

export async function submitMosqueApplicationAction(
  payload: MosqueApplicationInput,
): Promise<ApplyActionResult> {
  const session = await getSiteSession();
  if (!session) return { ok: false, error: "auth" };

  const parsed = mosqueApplicationSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" };
  }
  const data = parsed.data;

  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  // For a claim, the target mosque must exist and not already be managed.
  if (data.kind === "claim" && data.mosqueSlug) {
    const { mosque } = await fetchMosqueBySlug(data.mosqueSlug);
    if (!mosque) return { ok: false, error: "mosque_not_found" };
    if (mosque.managers && mosque.managers.length > 0) {
      return { ok: false, error: "already_managed" };
    }
    if (await hasPendingApplicationFor(session.uid, data.mosqueSlug)) {
      return { ok: false, error: "already_applied" };
    }
  }

  // Lightweight rate limit: cap concurrent pending applications per user.
  try {
    const pending = await db
      .collection(MOSQUE_APPLICATIONS_COLLECTION)
      .where("applicant.uid", "==", session.uid)
      .where("status", "==", "pending")
      .count()
      .get();
    if (pending.data().count >= MAX_PENDING_PER_USER) {
      return { ok: false, error: "rate_limited" };
    }
  } catch {
    // Missing index — don't block the application.
  }

  // Strip undefined from the plain data only; the serverTimestamp sentinels are
  // added afterward so stripUndefined never recurses into a FieldValue.
  const base = stripUndefined({
    kind: data.kind,
    mosqueSlug: data.kind === "claim" ? data.mosqueSlug : undefined,
    proposedMosque: data.kind === "register" ? data.proposedMosque : undefined,
    applicant: {
      uid: session.uid,
      email: session.email ?? "",
      name: session.name ?? null,
    },
    proofDoc: data.proofDoc,
    message: data.message,
    status: "pending" as const,
  });

  try {
    const ref = await db.collection(MOSQUE_APPLICATIONS_COLLECTION).add({
      ...base,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await createNotification({
      type: "submission",
      title: data.kind === "claim" ? "Masjid claim request" : "New masjid registration",
      body: (data.kind === "claim" ? data.mosqueSlug : data.proposedMosque?.name) ?? "",
      link: "/admin/mosques/applications",
      sourceCollection: MOSQUE_APPLICATIONS_COLLECTION,
      sourceId: ref.id,
    });
    return { ok: true, id: ref.id };
  } catch (err) {
    console.warn("[mosques/apply] write failed:", err);
    return { ok: false, error: "write_failed" };
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && typeof (v as { getTime?: unknown }).getTime !== "function") {
      const nested = stripUndefined(v as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
