import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { MOCK_MOSQUES, MOCK_MOSQUE_BY_SLUG } from "@/lib/admin/mock/mosques";
import type {
  Mosque,
  MosqueFilters,
  MosqueListResult,
  MosqueServices,
  MosqueSource,
  MosqueStatus,
  MosqueSubmission,
} from "@/types/mosque";
import { MOSQUES_COLLECTION, MOSQUE_SUBMISSIONS_COLLECTION, emptyServices } from "@/lib/mosques/constants";
import { mosqueMatchesQuery } from "@/lib/mosques/search";
import { distanceKm, sortByDistance } from "@/lib/mosques/geo";
import type { Timestamp } from "firebase-admin/firestore";

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v && "toDate" in v && typeof (v as Timestamp).toDate === "function") {
    return (v as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
}

function normalizeMosque(id: string, raw: Record<string, unknown>): Mosque | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw.name as Mosque["name"]) ?? { en: id };
  if (!name.en) return null;
  const services = { ...emptyServices(), ...((raw.services as Partial<MosqueServices>) ?? {}) };
  const location = raw.location as Mosque["location"] | undefined;
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") return null;
  return {
    slug: (raw.slug as string) ?? id,
    status: ((raw.status as MosqueStatus) ?? "draft"),
    name,
    legalName: raw.legalName as string | undefined,
    denomination: (raw.denomination as Mosque["denomination"]) ?? "unspecified",
    description: raw.description as Mosque["description"],
    address: (raw.address as Mosque["address"]) ?? { line1: "" },
    city: (raw.city as string) ?? "",
    citySlug: (raw.citySlug as string) ?? "",
    region: raw.region as string | undefined,
    country: (raw.country as string) ?? "",
    countrySlug: (raw.countrySlug as string) ?? ((raw.country as string) ?? "").toLowerCase(),
    location,
    geohash: (raw.geohash as string) ?? "",
    timezone: (raw.timezone as string) ?? "UTC",
    contact: raw.contact as Mosque["contact"],
    social: raw.social as Mosque["social"],
    capacity: raw.capacity as number | undefined,
    services,
    languages: (raw.languages as string[]) ?? [],
    prayerCalc: raw.prayerCalc as Mosque["prayerCalc"],
    iqamah: raw.iqamah as Mosque["iqamah"],
    coverImage: raw.coverImage as Mosque["coverImage"],
    gallery: raw.gallery as Mosque["gallery"],
    logoUrl: raw.logoUrl as string | undefined,
    submittedBy: raw.submittedBy as Mosque["submittedBy"],
    moderation: raw.moderation as Mosque["moderation"],
    searchTokens: (raw.searchTokens as string[]) ?? [],
    altSpellings: raw.altSpellings as string[] | undefined,
    stats: raw.stats as Mosque["stats"],
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    publishedAt: raw.publishedAt ? asIso(raw.publishedAt) : undefined,
  };
}

function normalizeSubmission(id: string, raw: Record<string, unknown>): MosqueSubmission | null {
  if (!raw) return null;
  const payload = raw.payload as MosqueSubmission["payload"];
  if (!payload) return null;
  return {
    id,
    status: (raw.status as MosqueSubmission["status"]) ?? "pending_review",
    payload,
    submittedBy: (raw.submittedBy as MosqueSubmission["submittedBy"]) ?? {},
    createdAt: asIso(raw.createdAt),
    decidedBy: raw.decidedBy as string | undefined,
    decidedAt: raw.decidedAt ? asIso(raw.decidedAt) : undefined,
    rejectionReason: raw.rejectionReason as string | undefined,
  };
}

// ---- Public reads (status === "published") ----

export async function fetchPublishedMosques(filters: MosqueFilters = {}): Promise<MosqueListResult> {
  const { mosques, source } = await fetchAllPublished();
  const filtered = applyFilters(mosques, filters);
  return { mosques: filtered, source, total: filtered.length };
}

async function fetchAllPublished(): Promise<{ mosques: Mosque[]; source: MosqueSource }> {
  const db = getDb();
  if (!db) return { mosques: MOCK_MOSQUES, source: "mock" };
  try {
    const snap = await db
      .collection(MOSQUES_COLLECTION)
      .where("status", "==", "published")
      .limit(2000)
      .get();
    if (snap.empty) return { mosques: MOCK_MOSQUES, source: "mock" };
    const mosques = snap.docs
      .map((d) => normalizeMosque(d.id, d.data() as Record<string, unknown>))
      .filter((m): m is Mosque => m !== null);
    return { mosques, source: "firestore" };
  } catch (err) {
    console.warn("[mosques] firestore read failed, falling back to mock:", err);
    return { mosques: MOCK_MOSQUES, source: "mock" };
  }
}

function applyFilters(mosques: Mosque[], filters: MosqueFilters): Mosque[] {
  let out = mosques;
  if (filters.q) {
    out = out.filter((m) => mosqueMatchesQuery(m, filters.q!));
  }
  if (filters.country) {
    const cc = filters.country.toUpperCase();
    out = out.filter((m) => m.country.toUpperCase() === cc);
  }
  if (filters.countrySlug) {
    out = out.filter((m) => m.countrySlug === filters.countrySlug);
  }
  if (filters.city) {
    const c = filters.city.toLowerCase();
    out = out.filter((m) => m.city.toLowerCase() === c);
  }
  if (filters.citySlug) {
    out = out.filter((m) => m.citySlug === filters.citySlug);
  }
  if (filters.denomination) {
    out = out.filter((m) => m.denomination === filters.denomination);
  }
  if (filters.services && filters.services.length > 0) {
    out = out.filter((m) => filters.services!.every((s) => m.services[s]));
  }
  if (filters.near) {
    const { lat, lng, radiusKm } = filters.near;
    out = out.filter((m) => distanceKm({ lat, lng }, m.location) <= radiusKm);
    out = sortByDistance(out, { lat, lng });
  }
  if (filters.limit && filters.limit > 0) out = out.slice(0, filters.limit);
  return out;
}

export async function fetchMosqueBySlug(slug: string): Promise<{ mosque: Mosque | null; source: MosqueSource }> {
  const db = getDb();
  if (!db) {
    const m = MOCK_MOSQUE_BY_SLUG.get(slug) ?? null;
    return { mosque: m, source: "mock" };
  }
  try {
    const doc = await db.collection(MOSQUES_COLLECTION).doc(slug).get();
    if (!doc.exists) {
      const m = MOCK_MOSQUE_BY_SLUG.get(slug) ?? null;
      if (m) return { mosque: m, source: "mock" };
      return { mosque: null, source: "firestore" };
    }
    return { mosque: normalizeMosque(doc.id, doc.data() as Record<string, unknown>), source: "firestore" };
  } catch (err) {
    console.warn("[mosques] firestore read failed, falling back to mock:", err);
    const m = MOCK_MOSQUE_BY_SLUG.get(slug) ?? null;
    return { mosque: m, source: "mock" };
  }
}

export async function fetchAllSlugs(limit = 200): Promise<string[]> {
  const db = getDb();
  if (!db) return MOCK_MOSQUES.slice(0, limit).map((m) => m.slug);
  try {
    const snap = await db
      .collection(MOSQUES_COLLECTION)
      .where("status", "==", "published")
      .select("slug")
      .limit(limit)
      .get();
    if (snap.empty) return MOCK_MOSQUES.slice(0, limit).map((m) => m.slug);
    return snap.docs.map((d) => (d.data().slug as string) ?? d.id);
  } catch {
    return MOCK_MOSQUES.slice(0, limit).map((m) => m.slug);
  }
}

// ---- Aggregates for hub pages ----

export interface CountryAggregate {
  countrySlug: string;
  country: string;
  count: number;
}

export interface CityAggregate {
  citySlug: string;
  city: string;
  countrySlug: string;
  count: number;
}

export async function fetchCountryAggregates(): Promise<CountryAggregate[]> {
  const { mosques } = await fetchAllPublished();
  const byCountry = new Map<string, CountryAggregate>();
  for (const m of mosques) {
    const key = m.countrySlug;
    const cur = byCountry.get(key);
    if (cur) cur.count += 1;
    else byCountry.set(key, { countrySlug: key, country: m.country, count: 1 });
  }
  return Array.from(byCountry.values()).sort((a, b) => b.count - a.count);
}

export async function fetchCityAggregates(countrySlug: string): Promise<CityAggregate[]> {
  const { mosques } = await fetchAllPublished();
  const byCity = new Map<string, CityAggregate>();
  for (const m of mosques) {
    if (m.countrySlug !== countrySlug) continue;
    const key = m.citySlug;
    const cur = byCity.get(key);
    if (cur) cur.count += 1;
    else byCity.set(key, { citySlug: key, city: m.city, countrySlug, count: 1 });
  }
  return Array.from(byCity.values()).sort((a, b) => b.count - a.count);
}

// ---- Admin reads (all statuses) ----

export type AdminMosqueRow =
  | { kind: "mosque"; mosque: Mosque }
  | { kind: "submission"; submission: MosqueSubmission };

export interface AdminMosquesResult {
  rows: AdminMosqueRow[];
  source: MosqueSource;
}

function rowSortKey(row: AdminMosqueRow): number {
  const iso = row.kind === "mosque" ? row.mosque.updatedAt : row.submission.createdAt;
  return new Date(iso).getTime();
}

export async function fetchAllMosquesAdmin(): Promise<AdminMosquesResult> {
  const db = getDb();
  if (!db) {
    return {
      rows: MOCK_MOSQUES.map((mosque) => ({ kind: "mosque" as const, mosque })),
      source: "mock",
    };
  }
  try {
    const [mosquesSnap, subsSnap] = await Promise.all([
      db.collection(MOSQUES_COLLECTION).orderBy("updatedAt", "desc").limit(500).get(),
      db
        .collection(MOSQUE_SUBMISSIONS_COLLECTION)
        .where("status", "==", "pending_review")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get(),
    ]);
    if (mosquesSnap.empty && subsSnap.empty) {
      return {
        rows: MOCK_MOSQUES.map((mosque) => ({ kind: "mosque" as const, mosque })),
        source: "mock",
      };
    }
    const mosqueRows: AdminMosqueRow[] = mosquesSnap.docs
      .map((d) => normalizeMosque(d.id, d.data() as Record<string, unknown>))
      .filter((m): m is Mosque => m !== null)
      .map((mosque) => ({ kind: "mosque", mosque }));
    const submissionRows: AdminMosqueRow[] = subsSnap.docs
      .map((d) => normalizeSubmission(d.id, d.data() as Record<string, unknown>))
      .filter((s): s is MosqueSubmission => s !== null)
      .map((submission) => ({ kind: "submission", submission }));
    const rows = [...mosqueRows, ...submissionRows].sort(
      (a, b) => rowSortKey(b) - rowSortKey(a),
    );
    return { rows, source: "firestore" };
  } catch (err) {
    console.warn("[mosques] admin firestore read failed, falling back to mock:", err);
    return {
      rows: MOCK_MOSQUES.map((mosque) => ({ kind: "mosque" as const, mosque })),
      source: "mock",
    };
  }
}

export async function countPendingMosques(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const [pendingDocs, pendingSubs] = await Promise.all([
      db.collection(MOSQUES_COLLECTION).where("status", "==", "pending_review").count().get(),
      db.collection(MOSQUE_SUBMISSIONS_COLLECTION).where("status", "==", "pending_review").count().get(),
    ]);
    return pendingDocs.data().count + pendingSubs.data().count;
  } catch {
    return 0;
  }
}
