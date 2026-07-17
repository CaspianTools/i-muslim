"use server";

import { revalidatePath } from "next/cache";
import { requireSiteSession } from "@/lib/auth/session";
import {
  findInterest,
  getProfile,
  isMatched,
  listInterestsForUser,
  listReports,
  patchProfile,
  upsertInterest,
  upsertReport,
} from "@/lib/matrimonial/store";
import {
  applyInterestUse,
  canExpressInterest,
} from "@/lib/matrimonial/rate-limit";
import type { MatrimonialInterest, ReportReason } from "@/types/matrimonial";

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
  revalidatePath("/profile/matrimonial");
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
  revalidatePath("/profile/matrimonial");
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
  revalidatePath("/profile/matrimonial");
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
  revalidatePath("/profile/matrimonial");
  revalidatePath("/admin/matrimonial");
}

export async function republishMyProfile(): Promise<void> {
  const session = await requireSiteSession();
  await patchProfile(session.uid, { status: "pending" });
  revalidatePath("/profile/matrimonial");
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
