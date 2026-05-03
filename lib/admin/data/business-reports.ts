import "server-only";
import { getDb } from "@/lib/firebase/admin";
import type { BusinessReport, BusinessReportReason, BusinessReportStatus } from "@/types/business";

const REASONS: BusinessReportReason[] = ["not_halal", "closed", "wrong_info", "offensive", "duplicate", "other"];
const STATUSES: BusinessReportStatus[] = ["open", "resolved", "dismissed"];

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === "object" &&
    v &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function asOptionalIso(v: unknown): string | undefined {
  if (!v) return undefined;
  return asIso(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function normalizeReport(id: string, raw: Record<string, unknown>): BusinessReport | null {
  if (!raw) return null;
  const businessId = asString(raw.businessId);
  if (!businessId) return null;

  const reasonRaw = typeof raw.reason === "string" ? raw.reason : "other";
  const reason: BusinessReportReason = REASONS.includes(reasonRaw as BusinessReportReason)
    ? (reasonRaw as BusinessReportReason)
    : "other";

  const statusRaw = typeof raw.status === "string" ? raw.status : "open";
  const status: BusinessReportStatus = STATUSES.includes(statusRaw as BusinessReportStatus)
    ? (statusRaw as BusinessReportStatus)
    : "open";

  return {
    id,
    businessId,
    businessSlug: asString(raw.businessSlug),
    businessName: asString(raw.businessName, "Unknown business"),
    reason,
    note: asOptionalString(raw.note),
    reporterEmail: asOptionalString(raw.reporterEmail),
    reporterIp: asOptionalString(raw.reporterIp),
    status,
    createdAt: asIso(raw.createdAt),
    resolvedAt: asOptionalIso(raw.resolvedAt),
    resolvedBy: asOptionalString(raw.resolvedBy),
  };
}

export type ReportsResult = {
  reports: BusinessReport[];
  source: "firestore" | "unavailable";
};

export async function fetchBusinessReports(): Promise<ReportsResult> {
  const db = getDb();
  if (!db) return { reports: [], source: "unavailable" };
  try {
    const snap = await db
      .collection("businessReports")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const reports = snap.docs
      .map((d) => normalizeReport(d.id, d.data() as Record<string, unknown>))
      .filter((r): r is BusinessReport => r !== null);
    return { reports, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/business-reports] read failed:", err);
    return { reports: [], source: "unavailable" };
  }
}

export async function countOpenReports(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const snap = await db
      .collection("businessReports")
      .where("status", "==", "open")
      .count()
      .get();
    return snap.data().count;
  } catch (err) {
    console.warn("[admin/data/business-reports] count failed:", err);
    return 0;
  }
}
