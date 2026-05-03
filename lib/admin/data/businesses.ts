import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { BUSINESS_SUBMISSIONS_COLLECTION } from "@/lib/businesses/constants";
import type { BusinessSubmissionInput } from "@/lib/businesses/schemas";
import type {
  Business,
  BusinessAddress,
  BusinessContact,
  BusinessHalal,
  BusinessHours,
  BusinessHoursDay,
  BusinessPhoto,
  BusinessStatus,
  HalalStatus,
  PartialLocalizedText,
  PriceTier,
} from "@/types/business";
import { BUSINESS_HOURS_DAYS } from "@/types/business";

export type BusinessesResult = {
  businesses: Business[];
  source: "firestore" | "unavailable";
};

const STATUSES: BusinessStatus[] = ["draft", "published", "archived"];
const HALAL_STATUSES: HalalStatus[] = ["certified", "self_declared", "muslim_owned", "unverified"];

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
  if (v === undefined || v === null) return undefined;
  return asIso(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asLocalized(raw: unknown): PartialLocalizedText {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    en: asString(r.en),
    ar: asOptionalString(r.ar),
    tr: asOptionalString(r.tr),
    id: asOptionalString(r.id),
  };
}

function asAddress(raw: unknown): BusinessAddress {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    line1: asString(r.line1),
    city: asString(r.city),
    region: asOptionalString(r.region),
    countryCode: asString(r.countryCode, "GB").toUpperCase(),
    postalCode: asOptionalString(r.postalCode),
    lat: asNumber(r.lat),
    lng: asNumber(r.lng),
  };
}

function asHoursEntry(raw: unknown): BusinessHours["mon"] {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const open = asOptionalString(r.open);
  const close = asOptionalString(r.close);
  if (!open || !close) return null;
  return { open, close };
}

function asHours(raw: unknown): BusinessHours {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: BusinessHours = {
    mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null,
  };
  for (const day of BUSINESS_HOURS_DAYS as BusinessHoursDay[]) {
    out[day] = asHoursEntry(r[day]);
  }
  out.notes = asOptionalString(r.notes);
  return out;
}

function asHalal(raw: unknown): BusinessHalal {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawStatus = typeof r.status === "string" ? r.status : "unverified";
  const status: HalalStatus = HALAL_STATUSES.includes(rawStatus as HalalStatus)
    ? (rawStatus as HalalStatus)
    : "unverified";
  return {
    status,
    certificationBodyId: asOptionalString(r.certificationBodyId),
    certificationNumber: asOptionalString(r.certificationNumber),
    expiresAt: asOptionalIso(r.expiresAt),
  };
}

function asContact(raw: unknown): BusinessContact {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    phone: asOptionalString(r.phone),
    email: asOptionalString(r.email),
    website: asOptionalString(r.website),
    instagram: asOptionalString(r.instagram),
    whatsapp: asOptionalString(r.whatsapp),
  };
}

function asPhotos(raw: unknown): BusinessPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const r = entry as Record<string, unknown>;
      const storagePath = asOptionalString(r.storagePath);
      if (!storagePath) return null;
      return {
        storagePath,
        alt: asOptionalString(r.alt),
        width: asOptionalNumber(r.width),
        height: asOptionalNumber(r.height),
      } as BusinessPhoto;
    })
    .filter((p): p is BusinessPhoto => p !== null);
}

export function normalizeBusiness(id: string, raw: Record<string, unknown>): Business | null {
  if (!raw) return null;
  const name = asOptionalString(raw.name);
  const slug = asOptionalString(raw.slug);
  if (!name || !slug) return null;

  const rawStatus = typeof raw.status === "string" ? raw.status : "draft";
  const status: BusinessStatus = STATUSES.includes(rawStatus as BusinessStatus)
    ? (rawStatus as BusinessStatus)
    : "draft";

  const priceTierRaw = asOptionalNumber(raw.priceTier);
  const priceTier: PriceTier | undefined =
    priceTierRaw === 1 || priceTierRaw === 2 || priceTierRaw === 3 || priceTierRaw === 4
      ? (priceTierRaw as PriceTier)
      : undefined;

  return {
    id,
    slug,
    status,
    source: raw.source === "owner-claim" ? "owner-claim" : "admin",
    name,
    description: asLocalized(raw.description),
    categoryIds: asStringArray(raw.categoryIds),
    halal: asHalal(raw.halal),
    muslimOwned: Boolean(raw.muslimOwned),
    platformVerifiedAt: asOptionalIso(raw.platformVerifiedAt),
    contact: asContact(raw.contact),
    address: asAddress(raw.address),
    hours: asHours(raw.hours),
    amenityIds: asStringArray(raw.amenityIds),
    priceTier,
    photos: asPhotos(raw.photos),
    ownerEmail: asOptionalString(raw.ownerEmail),
    searchTokens: asStringArray(raw.searchTokens),
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt ?? raw.createdAt),
    publishedAt: asOptionalIso(raw.publishedAt),
  };
}

export async function fetchBusinesses(): Promise<BusinessesResult> {
  const db = getDb();
  if (!db) return { businesses: [], source: "unavailable" };

  try {
    const snap = await db
      .collection("businesses")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const businesses = snap.docs
      .map((d) => normalizeBusiness(d.id, d.data() as Record<string, unknown>))
      .filter((b): b is Business => b !== null);
    return { businesses, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/businesses] Firestore read failed:", err);
    return { businesses: [], source: "unavailable" };
  }
}

export async function fetchBusinessById(id: string): Promise<Business | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const doc = await db.collection("businesses").doc(id).get();
    if (!doc.exists) return null;
    return normalizeBusiness(doc.id, doc.data() as Record<string, unknown>);
  } catch (err) {
    console.warn("[admin/data/businesses] fetchBusinessById failed:", err);
    return null;
  }
}

export type BusinessSubmissionStatus = "pending_review" | "approved" | "rejected";

export interface BusinessSubmission {
  id: string;
  status: BusinessSubmissionStatus;
  payload: Omit<BusinessSubmissionInput, "submitterEmail" | "website_url_secondary" | "turnstileToken">;
  submittedBy?: { email?: string };
  submitterIp?: string;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
  promotedBusinessId?: string;
}

export type BusinessSubmissionsResult = {
  submissions: BusinessSubmission[];
  source: "firestore" | "unavailable";
};

const SUBMISSION_STATUSES: BusinessSubmissionStatus[] = ["pending_review", "approved", "rejected"];

function normalizeSubmission(id: string, raw: Record<string, unknown>): BusinessSubmission | null {
  if (!raw) return null;
  const payload = raw.payload as BusinessSubmission["payload"] | undefined;
  if (!payload || typeof payload.name !== "string") return null;
  const statusRaw = typeof raw.status === "string" ? raw.status : "pending_review";
  const status: BusinessSubmissionStatus = SUBMISSION_STATUSES.includes(
    statusRaw as BusinessSubmissionStatus,
  )
    ? (statusRaw as BusinessSubmissionStatus)
    : "pending_review";
  return {
    id,
    status,
    payload,
    submittedBy: (raw.submittedBy as BusinessSubmission["submittedBy"]) ?? undefined,
    submitterIp: typeof raw.submitterIp === "string" ? raw.submitterIp : undefined,
    createdAt: asIso(raw.createdAt),
    decidedBy: typeof raw.decidedBy === "string" ? raw.decidedBy : undefined,
    decidedAt: raw.decidedAt ? asIso(raw.decidedAt) : undefined,
    rejectionReason: typeof raw.rejectionReason === "string" ? raw.rejectionReason : undefined,
    promotedBusinessId:
      typeof raw.promotedBusinessId === "string" ? raw.promotedBusinessId : undefined,
  };
}

export async function fetchBusinessSubmissions(): Promise<BusinessSubmissionsResult> {
  const db = getDb();
  if (!db) return { submissions: [], source: "unavailable" };
  try {
    const snap = await db
      .collection(BUSINESS_SUBMISSIONS_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const submissions = snap.docs
      .map((d) => normalizeSubmission(d.id, d.data() as Record<string, unknown>))
      .filter((s): s is BusinessSubmission => s !== null);
    return { submissions, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/businesses] fetchBusinessSubmissions failed:", err);
    return { submissions: [], source: "unavailable" };
  }
}

export async function countPendingBusinessSubmissions(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const snap = await db
      .collection(BUSINESS_SUBMISSIONS_COLLECTION)
      .where("status", "==", "pending_review")
      .count()
      .get();
    return snap.data().count;
  } catch {
    return 0;
  }
}
