"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/allowlist";
import { BUSINESS_SUBMISSIONS_COLLECTION } from "@/lib/businesses/constants";
import { createBusinessAction } from "@/lib/admin/actions/businesses";
import type { BusinessInput } from "@/lib/businesses/schemas";
import type { BusinessSubmission } from "@/lib/admin/data/businesses";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorizeAdmin() {
  const session = await requireAdminSession();
  if (!isAdminEmail(session.email)) throw new Error("Unauthorized");
  return session;
}

export async function rejectBusinessSubmissionAction(
  id: string,
  reason: string,
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
    await db.collection(BUSINESS_SUBMISSIONS_COLLECTION).doc(id).set(
      {
        status: "rejected",
        decidedBy: session.email,
        decidedAt: FieldValue.serverTimestamp(),
        rejectionReason: reason || null,
      },
      { merge: true },
    );
    revalidatePath("/admin/businesses/submissions");
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[actions/business-submissions] reject failed:", err);
    return { ok: false, error: "Failed to reject submission" };
  }
}

function buildBusinessInputFromSubmission(payload: BusinessSubmission["payload"]): BusinessInput {
  return {
    status: "draft",
    name: payload.name,
    description: { en: payload.descriptionEn },
    categoryIds: payload.categoryIds,
    halal: {
      status: payload.halalStatus,
      certificationBodyId: undefined,
      certificationNumber: undefined,
      expiresAt: undefined,
    },
    muslimOwned: payload.muslimOwned,
    platformVerifiedAt: undefined,
    contact: {
      phone: payload.phone,
      email: payload.email,
      website: payload.website,
      instagram: payload.instagram,
      whatsapp: payload.whatsapp,
    },
    address: {
      line1: payload.addressLine1,
      city: payload.city,
      region: payload.region,
      countryCode: payload.countryCode,
      postalCode: payload.postalCode,
      lat: 0,
      lng: 0,
    },
    hours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null, notes: undefined },
    amenityIds: [],
    priceTier: undefined,
    photos: [],
    ownerEmail: undefined,
  };
}

export async function promoteBusinessSubmissionAction(
  id: string,
): Promise<ActionResult<{ businessId: string; slug: string }>> {
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
    const subRef = db.collection(BUSINESS_SUBMISSIONS_COLLECTION).doc(id);
    const subSnap = await subRef.get();
    if (!subSnap.exists) return { ok: false, error: "Submission not found" };
    const subData = subSnap.data() as Record<string, unknown>;
    if (subData.status !== "pending_review") {
      return { ok: false, error: "Submission is not pending review" };
    }
    const payload = subData.payload as BusinessSubmission["payload"] | undefined;
    if (!payload || typeof payload.name !== "string") {
      return { ok: false, error: "Invalid submission payload" };
    }
    const submitterEmail =
      typeof (subData.submittedBy as { email?: unknown } | undefined)?.email === "string"
        ? ((subData.submittedBy as { email: string }).email)
        : undefined;

    const input = buildBusinessInputFromSubmission(payload);
    if (payload.isOwner && submitterEmail) {
      input.ownerEmail = submitterEmail;
    }

    const created = await createBusinessAction(input);
    if (!created.ok) return { ok: false, error: created.error };

    await subRef.set(
      {
        status: "approved",
        decidedBy: session.email,
        decidedAt: FieldValue.serverTimestamp(),
        promotedBusinessId: created.data.id,
      },
      { merge: true },
    );
    revalidatePath("/admin/businesses/submissions");
    revalidatePath("/admin/businesses");
    return { ok: true, data: { businessId: created.data.id, slug: created.data.slug } };
  } catch (err) {
    console.warn("[actions/business-submissions] promote failed:", err);
    return { ok: false, error: "Failed to promote submission" };
  }
}
