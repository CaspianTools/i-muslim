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
} from "@/types/mosque";
import { MOSQUES_COLLECTION, deriveFacilitiesFromServices } from "@/lib/mosques/constants";
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
  const rawServices = (raw.services as Partial<MosqueServices> | undefined) ?? undefined;
  const rawFacilities = Array.isArray(raw.facilities) ? (raw.facilities as string[]) : undefined;
  // New shape wins. For older records that only have the legacy `services`
  // boolean map, derive an equivalent slug array so the rest of the app sees
  // a single normalized field.
  const facilities =
    rawFacilities && rawFacilities.length > 0
      ? rawFacilities.filter((s) => typeof s === "string" && s.length > 0)
      : deriveFacilitiesFromServices(rawServices);
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
    facilities,
    services: rawServices as MosqueServices | undefined,
    languages: (raw.languages as string[]) ?? [],
    prayerCalc: raw.prayerCalc as Mosque["prayerCalc"],
    coverImage: raw.coverImage as Mosque["coverImage"],
    gallery: raw.gallery as Mosque["gallery"],
    logoUrl: raw.logoUrl as string | undefined,
    logoStoragePath: raw.logoStoragePath as string | undefined,
    submittedBy: raw.submittedBy as Mosque["submittedBy"],
    moderation: raw.moderation as Mosque["moderation"],
    managers: Array.isArray(raw.managers)
      ? (raw.managers as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        )
      : undefined,
    searchTokens: (raw.searchTokens as string[]) ?? [],
    altSpellings: raw.altSpellings as string[] | undefined,
    stats: raw.stats as Mosque["stats"],
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    publishedAt: raw.publishedAt ? asIso(raw.publishedAt) : undefined,
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
  if (filters.facilities && filters.facilities.length > 0) {
    out = out.filter((m) => filters.facilities!.every((slug) => m.facilities.includes(slug)));
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

export interface AdminMosquesResult {
  mosques: Mosque[];
  source: MosqueSource;
}

export async function fetchAllMosquesAdmin(): Promise<AdminMosquesResult> {
  const db = getDb();
  if (!db) return { mosques: MOCK_MOSQUES, source: "mock" };
  try {
    const snap = await db
      .collection(MOSQUES_COLLECTION)
      .orderBy("updatedAt", "desc")
      .limit(500)
      .get();
    if (snap.empty) return { mosques: MOCK_MOSQUES, source: "mock" };
    const mosques = snap.docs
      .map((d) => normalizeMosque(d.id, d.data() as Record<string, unknown>))
      .filter((m): m is Mosque => m !== null);
    return { mosques, source: "firestore" };
  } catch (err) {
    console.warn("[mosques] admin firestore read failed, falling back to mock:", err);
    return { mosques: MOCK_MOSQUES, source: "mock" };
  }
}

export async function countPendingMosques(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const pending = await db
      .collection(MOSQUES_COLLECTION)
      .where("status", "==", "pending_review")
      .count()
      .get();
    return pending.data().count;
  } catch {
    return 0;
  }
}
