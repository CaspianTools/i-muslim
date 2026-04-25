"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/session";
import {
  deleteProfileById,
  getProfile,
  patchProfile,
  upsertReport,
} from "@/lib/matrimonial/store";
import type { MatrimonialProfile, ReportStatus } from "@/types/matrimonial";

async function ensureAdmin() {
  const session = await requireAdminSession();
  return session;
}

export async function setProfileStatus(
  id: string,
  status: MatrimonialProfile["status"],
): Promise<void> {
  await ensureAdmin();
  await patchProfile(id, { status });
  revalidatePath("/admin/matrimonial");
}

export async function setProfileVerification(
  id: string,
  patch: Partial<MatrimonialProfile["verification"]>,
): Promise<void> {
  await ensureAdmin();
  const current = await getProfile(id);
  if (!current) return;
  await patchProfile(id, {
    verification: { ...current.verification, ...patch },
  });
  revalidatePath("/admin/matrimonial");
}

export async function deleteProfile(id: string): Promise<void> {
  await ensureAdmin();
  await deleteProfileById(id);
  revalidatePath("/admin/matrimonial");
}

export async function bulkSetStatus(
  ids: string[],
  status: MatrimonialProfile["status"],
): Promise<void> {
  await ensureAdmin();
  await Promise.all(ids.map((id) => patchProfile(id, { status })));
  revalidatePath("/admin/matrimonial");
}

export async function bulkDelete(ids: string[]): Promise<void> {
  await ensureAdmin();
  await Promise.all(ids.map((id) => deleteProfileById(id)));
  revalidatePath("/admin/matrimonial");
}

export async function setReportStatus(
  reportId: string,
  status: ReportStatus,
  resolverEmail: string | null,
): Promise<void> {
  await ensureAdmin();
  const { listReports } = await import("@/lib/matrimonial/store");
  const reports = await listReports();
  const r = reports.find((x) => x.id === reportId);
  if (!r) return;
  await upsertReport({
    ...r,
    status,
    resolvedAt: status === "open" ? null : new Date().toISOString(),
    resolvedBy: status === "open" ? null : resolverEmail,
  });
  revalidatePath("/admin/matrimonial");
}
