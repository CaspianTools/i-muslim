"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSiteSession } from "@/lib/auth/session";
import {
  findInterest,
  getProfile,
  isMatched,
  listInterests,
  listInterestsForUser,
  listReports,
  patchProfile,
  upsertInterest,
  upsertProfile,
  upsertReport,
} from "@/lib/matrimonial/store";
import {
  applyInterestUse,
  canExpressInterest,
  nextMidnightUtc,
} from "@/lib/matrimonial/rate-limit";
import { ageFromDob } from "@/lib/matrimonial/age";
import type {
  MatrimonialInterest,
  MatrimonialPhoto,
  MatrimonialProfile,
  ReportReason,
} from "@/types/matrimonial";

const profileSchema = z.object({
  displayName: z.string().min(2).max(60),
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().min(8),
  country: z.string().min(2).max(60),
  city: z.string().min(1).max(60),
  ethnicity: z.string().max(60).optional().or(z.literal("")),
  languages: z.string().max(120).optional().or(z.literal("")),
  madhhab: z.enum(["hanafi", "maliki", "shafii", "hanbali", "other", "none"]),
  sect: z.enum(["sunni", "shia", "other"]),
  prayerCommitment: z.enum(["always", "mostly", "sometimes", "rarely", "learning"]),
  hijab: z.enum(["niqab", "khimar", "shayla", "none", "na"]),
  beard: z.enum(["full", "trimmed", "none", "na"]),
  revert: z.boolean().default(false),
  polygamyStance: z.enum(["open", "neutral", "closed", "na"]),
  maritalHistory: z.enum(["never_married", "divorced", "widowed"]),
  hasChildren: z.boolean().default(false),
  wantsChildren: z.enum(["yes", "no", "maybe"]),
  education: z.enum(["high_school", "diploma", "bachelor", "master", "phd", "other"]),
  profession: z.string().max(80).optional().or(z.literal("")),
  lookingForGender: z.enum(["male", "female"]),
  ageMin: z.number().int().min(18).max(99),
  ageMax: z.number().int().min(18).max(99),
  preferredCountries: z.string().max(200).optional().or(z.literal("")),
  preferredMadhhabs: z.string().max(120).optional().or(z.literal("")),
  prayerMin: z.enum(["always", "mostly", "sometimes", "rarely", "learning"]),
  polygamyAcceptable: z.boolean().default(false),
  bio: z.string().min(50).max(800),
  photoStubs: z.array(z.string().url()).max(6).default([]),
});

export type ProfileFormInput = z.infer<typeof profileSchema>;

export type ProfileFormResult =
  | { ok: true; profile: MatrimonialProfile }
  | { ok: false; error: string };

function csvToList(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function saveProfile(input: ProfileFormInput): Promise<ProfileFormResult> {
  const session = await requireSiteSession();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile" };
  }
  const v = parsed.data;
  if (ageFromDob(v.dateOfBirth) < 18) {
    return { ok: false, error: "Must be at least 18." };
  }
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
  const profile: MatrimonialProfile = {
    id: session.uid,
    userId: session.uid,
    displayName: v.displayName,
    gender: v.gender,
    dateOfBirth: v.dateOfBirth,
    country: v.country,
    city: v.city,
    ethnicity: v.ethnicity ? v.ethnicity : null,
    languages: csvToList(v.languages),
    madhhab: v.madhhab,
    sect: v.sect,
    prayerCommitment: v.prayerCommitment,
    hijab: v.hijab,
    beard: v.beard,
    revert: v.revert,
    polygamyStance: v.polygamyStance,
    maritalHistory: v.maritalHistory,
    hasChildren: v.hasChildren,
    wantsChildren: v.wantsChildren,
    education: v.education,
    profession: v.profession ? v.profession : null,
    preferences: {
      lookingForGender: v.lookingForGender,
      ageMin: v.ageMin,
      ageMax: v.ageMax,
      countries: csvToList(v.preferredCountries),
      locationRadiusKm: null,
      madhhabs: csvToList(v.preferredMadhhabs).filter((m) =>
        ["hanafi", "maliki", "shafii", "hanbali", "other", "none"].includes(m),
      ) as MatrimonialProfile["preferences"]["madhhabs"],
      sects: [],
      prayerMin: v.prayerMin,
      polygamyAcceptable: v.polygamyAcceptable,
    },
    bio: v.bio,
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
  await upsertProfile(profile);
  revalidatePath("/matrimonial");
  revalidatePath("/admin/matrimonial");
  return { ok: true, profile };
}

export async function expressInterest(
  toUserId: string,
  message: string | null,
): Promise<{
  ok: boolean;
  reason?: "rate_limit" | "no_profile" | "self";
  remaining?: number;
  resetsAt?: string;
}> {
  const session = await requireSiteSession();
  if (session.uid === toUserId) return { ok: false, reason: "self" };
  const me = await getProfile(session.uid);
  if (!me) return { ok: false, reason: "no_profile" };

  const check = canExpressInterest(me);
  if (!check.ok) {
    return { ok: false, reason: "rate_limit", remaining: 0, resetsAt: check.resetsAt };
  }

  const existing = await findInterest(session.uid, toUserId);
  const now = new Date().toISOString();
  const id = existing?.id ?? `i_${session.uid}_${toUserId}`;
  const interest: MatrimonialInterest = {
    id,
    fromUserId: session.uid,
    toUserId,
    status: "pending",
    message: message?.slice(0, 200) ?? null,
    createdAt: existing?.createdAt ?? now,
    respondedAt: null,
  };
  await upsertInterest(interest);
  await patchProfile(session.uid, {
    rateLimit: applyInterestUse(me),
    lastActiveAt: now,
  });
  revalidatePath(`/matrimonial/${toUserId}`);
  revalidatePath("/matrimonial/inbox");
  return { ok: true, remaining: check.remaining - 1, resetsAt: check.resetsAt };
}

export async function withdrawInterest(toUserId: string): Promise<void> {
  const session = await requireSiteSession();
  const existing = await findInterest(session.uid, toUserId);
  if (!existing) return;
  await upsertInterest({
    ...existing,
    status: "withdrawn",
    respondedAt: new Date().toISOString(),
  });
  revalidatePath(`/matrimonial/${toUserId}`);
  revalidatePath("/matrimonial/inbox");
}

export async function respondInterest(
  fromUserId: string,
  decision: "accepted" | "declined",
): Promise<void> {
  const session = await requireSiteSession();
  const existing = await findInterest(fromUserId, session.uid);
  if (!existing) return;
  await upsertInterest({
    ...existing,
    status: decision,
    respondedAt: new Date().toISOString(),
  });
  revalidatePath(`/matrimonial/${fromUserId}`);
  revalidatePath("/matrimonial/inbox");
}

export async function reportProfile(
  targetUserId: string,
  reason: ReportReason,
  notes: string | null,
): Promise<{ ok: boolean; rateLimit?: boolean }> {
  const session = await requireSiteSession();
  const reports = await listReports();
  const today = new Date().toISOString().slice(0, 10);
  const myToday = reports.filter(
    (r) => r.reporterUserId === session.uid && r.createdAt.slice(0, 10) === today,
  );
  if (myToday.length >= 5) return { ok: false, rateLimit: true };

  const id = `r_${session.uid}_${targetUserId}_${Date.now()}`;
  await upsertReport({
    id,
    reporterUserId: session.uid,
    targetUserId,
    reason,
    notes: notes?.slice(0, 500) ?? null,
    status: "open",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  });

  const distinctReporters = new Set(
    reports.filter((r) => r.targetUserId === targetUserId).map((r) => r.reporterUserId),
  );
  distinctReporters.add(session.uid);
  if (distinctReporters.size >= 3) {
    await patchProfile(targetUserId, { status: "pending" });
  }
  revalidatePath(`/matrimonial/${targetUserId}`);
  revalidatePath("/admin/matrimonial");
  return { ok: true };
}

export async function hideMyProfile(): Promise<void> {
  const session = await requireSiteSession();
  await patchProfile(session.uid, { status: "hidden" });
  revalidatePath("/matrimonial/settings");
  revalidatePath("/admin/matrimonial");
}

export async function republishMyProfile(): Promise<void> {
  const session = await requireSiteSession();
  await patchProfile(session.uid, { status: "pending" });
  revalidatePath("/matrimonial/settings");
  revalidatePath("/admin/matrimonial");
}

export async function deleteMyProfile(): Promise<void> {
  const session = await requireSiteSession();
  const { deleteProfileById } = await import("@/lib/matrimonial/store");
  await deleteProfileById(session.uid);
  revalidatePath("/matrimonial");
  revalidatePath("/admin/matrimonial");
}

export async function fetchMyInbox(): Promise<{
  incoming: MatrimonialInterest[];
  outgoing: MatrimonialInterest[];
  matchedIds: string[];
}> {
  const session = await requireSiteSession();
  const { incoming, outgoing } = await listInterestsForUser(session.uid);
  const matched: string[] = [];
  for (const a of outgoing.filter((i) => i.status === "accepted")) {
    if (await isMatched(session.uid, a.toUserId)) matched.push(a.toUserId);
  }
  return { incoming, outgoing, matchedIds: matched };
}

export async function fetchAllInterestsServer(): Promise<MatrimonialInterest[]> {
  await requireSiteSession();
  return listInterests();
}
