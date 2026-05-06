"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb, getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { requirePermission } from "@/lib/permissions/server";
import { reportInputSchema, type ReportInput } from "@/lib/businesses/schemas";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorizeAdmin() {
  return await requirePermission("businesses.write");
}

export async function submitBusinessReportAction(
  input: ReportInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const db = getDb();
  if (!db) return { ok: false, error: "Persistence is not configured." };
  try {
    const businessSnap = await db.collection("businesses").doc(parsed.data.businessId).get();
    if (!businessSnap.exists) return { ok: false, error: "Business not found" };
    const data = businessSnap.data() as Record<string, unknown>;
    const businessSlug = typeof data.slug === "string" ? data.slug : "";
    const businessName = typeof data.name === "string" ? data.name : "Unknown business";

    const session = await getSiteSession();
    const ref = await db.collection("businessReports").add({
      businessId: parsed.data.businessId,
      businessSlug,
      businessName,
      reason: parsed.data.reason,
      note: parsed.data.note,
      reporterEmail: parsed.data.reporterEmail ?? session?.email ?? null,
      status: "open",
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath("/admin/businesses/reports");
    return { ok: true, data: { id: ref.id } };
  } catch (err) {
    console.warn("[actions/business-reports] submit failed:", err);
    return { ok: false, error: "Failed to submit report" };
  }
}

export async function resolveReportAction(id: string): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("businessReports").doc(id).set(
      {
        status: "resolved",
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: session.email,
      },
      { merge: true },
    );
    revalidatePath("/admin/businesses/reports");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to resolve report" };
  }
}

export async function dismissReportAction(id: string): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await authorizeAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };
  let db: FirebaseFirestore.Firestore;
  try { db = requireDb(); } catch { return { ok: false, error: "Firestore is not configured." }; }
  try {
    await db.collection("businessReports").doc(id).set(
      {
        status: "dismissed",
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: session.email,
      },
      { merge: true },
    );
    revalidatePath("/admin/businesses/reports");
    return { ok: true, data: { id } };
  } catch {
    return { ok: false, error: "Failed to dismiss report" };
  }
}
