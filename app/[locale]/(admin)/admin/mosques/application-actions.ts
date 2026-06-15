"use server";

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/permissions/server";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { buildMosqueSlug, withCollisionSuffix } from "@/lib/mosques/slug";
import { buildSearchTokens } from "@/lib/mosques/search";
import { geohashFor } from "@/lib/mosques/geo";
import { defaultPrayerCalc, suggestPrayerCalc } from "@/lib/mosques/adhan";
import { generateUniqueShortCode } from "@/lib/admin/data/mosques";
import { createMosqueReadUrl } from "@/lib/mosques/storage";
import {
  MOSQUE_APPLICATIONS_COLLECTION,
  normalizeApplication,
} from "@/lib/mosques/applications";

export interface AppActionResult {
  ok: boolean;
  error?: string;
  slug?: string;
}

function citySlugFor(city: string): string {
  return (
    city
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "city"
  );
}

async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  if (!db) return base;
  const taken = new Set<string>();
  const baseDoc = await db.collection(MOSQUES_COLLECTION).doc(base).get();
  if (baseDoc.exists) taken.add(base);
  for (let i = 2; i <= 5; i += 1) {
    const probe = `${base}-${i}`;
    const d = await db.collection(MOSQUES_COLLECTION).doc(probe).get();
    if (d.exists) taken.add(probe);
  }
  return withCollisionSuffix(base, taken);
}

/** Mint a short-lived signed URL so an admin can view a proof document. */
export async function getApplicationProofUrlAction(
  storagePath: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    await requirePermission("mosques.read");
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  if (!storagePath.startsWith("mosques/")) return { ok: false, error: "invalid_path" };
  try {
    return { ok: true, url: await createMosqueReadUrl(storagePath) };
  } catch (err) {
    console.warn("[mosqueApplications] proof url failed:", err);
    return { ok: false, error: "failed" };
  }
}

export async function approveMosqueApplication(appId: string): Promise<AppActionResult> {
  const session = await requirePermission("mosques.publish");
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };

  const appRef = db.collection(MOSQUE_APPLICATIONS_COLLECTION).doc(appId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) return { ok: false, error: "not_found" };
  const app = normalizeApplication(appSnap.id, appSnap.data() as Record<string, unknown>);
  if (!app) return { ok: false, error: "invalid" };
  if (app.status !== "pending") return { ok: false, error: "already_reviewed" };

  const now = new Date();
  const claimedBy = { uid: app.applicant.uid, email: app.applicant.email, at: now.toISOString() };
  let slug: string;

  if (app.kind === "claim") {
    slug = app.mosqueSlug ?? "";
    const ref = db.collection(MOSQUES_COLLECTION).doc(slug);
    const m = await ref.get();
    if (!m.exists) return { ok: false, error: "mosque_not_found" };
    const existing = m.data() ?? {};
    if (Array.isArray(existing.managers) && existing.managers.length > 0) {
      return { ok: false, error: "already_managed" };
    }
    const shortCode = (existing.shortCode as string | undefined) ?? (await generateUniqueShortCode());
    await ref.update({
      managers: [app.applicant.uid], // single manager (assignment, not arrayUnion)
      claimedBy,
      shortCode,
      // A claimed published listing stays public (it already has content); an
      // unpublished one drops to claimed_draft for the manager to fill in.
      ...(existing.status === "published" ? {} : { status: "claimed_draft" }),
      updatedAt: Timestamp.fromDate(now),
    });
  } else {
    const proposed = app.proposedMosque;
    if (!proposed) return { ok: false, error: "invalid" };
    const baseSlug = buildMosqueSlug(proposed.name, citySlugFor(proposed.city));
    slug = await uniqueSlug(baseSlug);
    const shortCode = await generateUniqueShortCode();
    const country = proposed.country.toUpperCase();
    const denomination = proposed.denomination ?? "unspecified";
    const tokensSource = {
      name: { en: proposed.name },
      city: proposed.city,
      country,
      denomination,
      languages: [] as string[],
      address: { line1: proposed.address ?? "" },
    };
    const data = {
      slug,
      status: "claimed_draft",
      name: { en: proposed.name },
      denomination,
      address: { line1: proposed.address ?? "" },
      city: proposed.city,
      citySlug: citySlugFor(proposed.city),
      country,
      countrySlug: country.toLowerCase(),
      location: proposed.location,
      geohash: geohashFor(proposed.location.lat, proposed.location.lng),
      timezone: proposed.timezone,
      facilities: [] as string[],
      languages: [] as string[],
      prayerCalc: suggestPrayerCalc(country, denomination) ?? defaultPrayerCalc(),
      managers: [app.applicant.uid],
      claimedBy,
      shortCode,
      submittedBy: { uid: app.applicant.uid, email: app.applicant.email },
      moderation: { reviewedBy: session.uid, reviewedAt: now.toISOString() },
      searchTokens: buildSearchTokens(tokensSource),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };
    await db.collection(MOSQUES_COLLECTION).doc(slug).set(data, { merge: false });
  }

  await appRef.update({
    status: "approved",
    reviewedBy: session.uid,
    reviewedAt: now.toISOString(),
    updatedAt: Timestamp.fromDate(now),
    ...(app.kind === "register" ? { createdMosqueSlug: slug } : {}),
  });

  revalidatePath("/admin/mosques/applications");
  revalidatePath("/admin/mosques");
  revalidatePath(`/mosques/${slug}`);
  return { ok: true, slug };
}

export async function rejectMosqueApplication(
  appId: string,
  reason: string,
): Promise<AppActionResult> {
  const session = await requirePermission("mosques.publish");
  const db = getDb();
  if (!db) return { ok: false, error: "firestore_not_configured" };
  const ref = db.collection(MOSQUE_APPLICATIONS_COLLECTION).doc(appId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "not_found" };
  await ref.update({
    status: "rejected",
    rejectionReason: reason || "",
    reviewedBy: session.uid,
    reviewedAt: new Date().toISOString(),
    updatedAt: Timestamp.fromDate(new Date()),
  });
  revalidatePath("/admin/mosques/applications");
  return { ok: true };
}
