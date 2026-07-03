import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { getDb } from "@/lib/firebase/admin";
import type {
  BusinessAmenity,
  BusinessCategory,
  BusinessCertificationBody,
  LocalizedTextRequired,
} from "@/types/business";
import { BUNDLED_LOCALES, type BundledLocale } from "@/i18n/config";

type Source = "firestore" | "unavailable";

function asLocalizedRequired(raw: unknown, fallback: string): LocalizedTextRequired {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out = {} as LocalizedTextRequired;
  for (const l of BUNDLED_LOCALES as readonly BundledLocale[]) {
    out[l] = typeof r[l] === "string" && (r[l] as string).length > 0 ? (r[l] as string) : fallback;
  }
  return out;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function normalizeCategory(id: string, raw: Record<string, unknown>): BusinessCategory | null {
  const slug = asString(raw.slug);
  if (!slug) return null;
  const sortRaw = typeof raw.sortOrder === "number" ? raw.sortOrder : 0;
  return {
    id,
    slug,
    name: asLocalizedRequired(raw.name, slug),
    iconKey: asOptionalString(raw.iconKey),
    sortOrder: sortRaw,
    isActive: raw.isActive !== false,
  };
}

function normalizeAmenity(id: string, raw: Record<string, unknown>): BusinessAmenity | null {
  const slug = asString(raw.slug);
  if (!slug) return null;
  return {
    id,
    slug,
    name: asLocalizedRequired(raw.name, slug),
    iconKey: asOptionalString(raw.iconKey),
  };
}

function normalizeCertBody(id: string, raw: Record<string, unknown>): BusinessCertificationBody | null {
  const slug = asString(raw.slug);
  const name = asString(raw.name);
  if (!slug || !name) return null;
  return {
    id,
    slug,
    name,
    country: asString(raw.country, "GB").toUpperCase(),
    website: asOptionalString(raw.website),
    logoStoragePath: asOptionalString(raw.logoStoragePath),
    verifiedByPlatform: Boolean(raw.verifiedByPlatform),
  };
}

// Business taxonomies (categories, amenities, cert bodies) are read on the home
// page and the businesses index but change only when an admin edits them. Cache
// each in the Data Cache with a longer TTL; invalidate on write via
// `revalidateBusinessTaxonomies`.
export const BUSINESS_TAXONOMIES_TAG = "businesses:taxonomies";
const TAXONOMY_REVALIDATE = 60 * 60; // 1 hour fallback; admin edits invalidate immediately

// Call from the admin business-taxonomy write action after any category/amenity/
// cert-body change.
export function revalidateBusinessTaxonomies(): void {
  revalidateTag(BUSINESS_TAXONOMIES_TAG, { expire: 0 });
}

export const fetchCategories = unstable_cache(
  async (): Promise<{ categories: BusinessCategory[]; source: Source }> => {
    const db = getDb();
    if (!db) return { categories: [], source: "unavailable" };
    try {
      const snap = await db.collection("categories").orderBy("sortOrder", "asc").limit(200).get();
      const categories = snap.docs
        .map((d) => normalizeCategory(d.id, d.data() as Record<string, unknown>))
        .filter((c): c is BusinessCategory => c !== null);
      return { categories, source: "firestore" };
    } catch (err) {
      console.warn("[admin/data/business-taxonomies] categories read failed:", err);
      return { categories: [], source: "unavailable" };
    }
  },
  ["businesses:taxonomies:categories"],
  { revalidate: TAXONOMY_REVALIDATE, tags: [BUSINESS_TAXONOMIES_TAG] },
);

export const fetchAmenities = unstable_cache(
  async (): Promise<{ amenities: BusinessAmenity[]; source: Source }> => {
    const db = getDb();
    if (!db) return { amenities: [], source: "unavailable" };
    try {
      const snap = await db.collection("amenityTaxonomy").limit(200).get();
      const amenities = snap.docs
        .map((d) => normalizeAmenity(d.id, d.data() as Record<string, unknown>))
        .filter((a): a is BusinessAmenity => a !== null);
      return { amenities, source: "firestore" };
    } catch (err) {
      console.warn("[admin/data/business-taxonomies] amenities read failed:", err);
      return { amenities: [], source: "unavailable" };
    }
  },
  ["businesses:taxonomies:amenities"],
  { revalidate: TAXONOMY_REVALIDATE, tags: [BUSINESS_TAXONOMIES_TAG] },
);

export const fetchCertBodies = unstable_cache(
  async (): Promise<{ certBodies: BusinessCertificationBody[]; source: Source }> => {
    const db = getDb();
    if (!db) return { certBodies: [], source: "unavailable" };
    try {
      const snap = await db.collection("certificationBodies").limit(200).get();
      const certBodies = snap.docs
        .map((d) => normalizeCertBody(d.id, d.data() as Record<string, unknown>))
        .filter((c): c is BusinessCertificationBody => c !== null);
      return { certBodies, source: "firestore" };
    } catch (err) {
      console.warn("[admin/data/business-taxonomies] certBodies read failed:", err);
      return { certBodies: [], source: "unavailable" };
    }
  },
  ["businesses:taxonomies:cert-bodies"],
  { revalidate: TAXONOMY_REVALIDATE, tags: [BUSINESS_TAXONOMIES_TAG] },
);
