"use server";

import { revalidatePath } from "next/cache";
import { requireSiteSession } from "@/lib/auth/session";
import { getProfileFields } from "@/lib/profile/data";
import {
  csvToList,
  matrimonialFieldsSchema,
  type MatrimonialFieldsInput,
} from "@/lib/profile/schema";
import { ageFromDob } from "@/lib/matrimonial/age";
import { nextMidnightUtc } from "@/lib/matrimonial/rate-limit";
import {
  deleteProfileById,
  getProfile,
  upsertProfile,
} from "@/lib/matrimonial/store";
import type { MatrimonialPhoto, MatrimonialProfile } from "@/types/matrimonial";

export type EnableMatrimonialResult =
  | { ok: true }
  | { ok: false; error: string; missingProfile?: boolean };

export async function enableMatrimonialAction(
  input: MatrimonialFieldsInput,
): Promise<EnableMatrimonialResult> {
  const session = await requireSiteSession();

  const profile = await getProfileFields(session.uid);
  if (!profile) {
    return {
      ok: false,
      error: "Complete your profile fields first.",
      missingProfile: true,
    };
  }
  if (ageFromDob(profile.dateOfBirth) < 18) {
    return { ok: false, error: "You must be at least 18." };
  }

  const parsed = matrimonialFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid fields" };
  }
  const v = parsed.data;
  if (v.ageMin > v.ageMax) {
    return { ok: false, error: "Maximum age must be greater than minimum." };
  }

  const existing = await getProfile(session.uid);
  const now = new Date().toISOString();
  const photos: MatrimonialPhoto[] = v.photoStubs.map((url, i) => ({
    id: `${session.uid}_p${i}`,
    url,
    visibility: "match_only",
    uploadedAt: now,
  }));

  const merged: MatrimonialProfile = {
    id: session.uid,
    userId: session.uid,
    // Identity + deen mirrored from the unified profile.
    displayName: profile.displayName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    country: profile.country,
    city: profile.city,
    ethnicity: profile.ethnicity,
    languages: profile.languages,
    madhhab: profile.madhhab,
    sect: profile.sect,
    prayerCommitment: profile.prayerCommitment,
    hijab: profile.hijab,
    beard: profile.beard,
    revert: profile.revert,
    polygamyStance: v.polygamyStance,
    maritalHistory: profile.maritalHistory,
    hasChildren: profile.hasChildren,
    wantsChildren: profile.wantsChildren,
    education: profile.education,
    profession: profile.profession,
    bio: profile.bio,
    // Matrimonial-only.
    preferences: {
      lookingForGender: v.lookingForGender,
      ageMin: v.ageMin,
      ageMax: v.ageMax,
      countries: v.preferredCountries,
      locationRadiusKm: null,
      madhhabs: csvToList(v.preferredMadhhabs).filter((m) =>
        ["hanafi", "maliki", "shafii", "hanbali", "other", "none"].includes(m),
      ) as MatrimonialProfile["preferences"]["madhhabs"],
      sects: [],
      prayerMin: v.prayerMin,
      polygamyAcceptable: v.polygamyAcceptable,
    },
    photos,
    status: existing?.status === "active" ? "active" : "pending",
    verification: existing?.verification ?? {
      emailVerified: true,
      phoneVerified: false,
      photoVerified: false,
      idVerified: false,
    },
    subscription: existing?.subscription ?? { tier: "free", expiresAt: null },
    rateLimit: existing?.rateLimit ?? {
      dailyInterestsUsed: 0,
      dailyInterestsResetAt: nextMidnightUtc(),
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastActiveAt: now,
  };

  await upsertProfile(merged);
  revalidatePath("/profile/matrimonial");
  revalidatePath("/matrimonial");
  revalidatePath("/admin/matrimonial");
  return { ok: true };
}

export async function disableMatrimonialAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSiteSession();
  await deleteProfileById(session.uid);
  revalidatePath("/profile/matrimonial");
  revalidatePath("/matrimonial");
  revalidatePath("/admin/matrimonial");
  return { ok: true };
}
