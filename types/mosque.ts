export type LocalizedString = {
  en: string;
  ar?: string;
  tr?: string;
  id?: string;
};

export type MosqueStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected"
  | "suspended";

export type Denomination =
  | "sunni"
  | "shia"
  | "ibadi"
  | "ahmadi"
  | "other"
  | "unspecified";

export type CalcMethod =
  | "MWL"
  | "ISNA"
  | "EGYPT"
  | "MAKKAH"
  | "KARACHI"
  | "TEHRAN"
  | "JAFARI";

export type AsrMethod = "shafi" | "hanafi";

export type HighLatitudeRule =
  | "MIDDLE_OF_NIGHT"
  | "ANGLE_BASED"
  | "ONE_SEVENTH";

export type PrayerKey =
  | "fajr"
  | "dhuhr"
  | "jumuah"
  | "asr"
  | "maghrib"
  | "isha";

export interface MosqueServices {
  fridayPrayer: boolean;
  womenSection: boolean;
  wuduFacilities: boolean;
  wheelchairAccess: boolean;
  parking: boolean;
  quranClasses: boolean;
  library: boolean;
  funeralServices: boolean;
  nikahServices: boolean;
  accommodatesItikaf: boolean;
}

export interface MosqueAddress {
  line1: string;
  line2?: string;
  postalCode?: string;
}

export interface MosqueContact {
  phone?: string;
  email?: string;
  website?: string;
}

export interface MosqueSocial {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
}

export interface MosqueImage {
  url: string;
  storagePath?: string;
  width?: number;
  height?: number;
  alt?: string;
  blurhash?: string;
}

export interface PrayerCalcConfig {
  method: CalcMethod;
  asrMethod: AsrMethod;
  highLatitudeRule: HighLatitudeRule;
}

export interface MosqueModeration {
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface MosqueStats {
  viewsLast30d?: number;
}

export interface Mosque {
  slug: string;
  status: MosqueStatus;
  name: LocalizedString;
  legalName?: string;
  denomination: Denomination;
  description?: LocalizedString;
  // Location
  address: MosqueAddress;
  city: string;
  citySlug: string;
  region?: string;
  country: string; // ISO-3166 alpha-2
  countrySlug: string;
  location: { lat: number; lng: number };
  geohash: string;
  timezone: string; // IANA
  // Contact
  contact?: MosqueContact;
  social?: MosqueSocial;
  // Facets
  capacity?: number;
  /**
   * Slugs into the `mosqueFacilities` taxonomy. Source of truth for facilities
   * going forward. Older records may have only `services` set; the read path
   * derives `facilities` from `services` for back-compat.
   */
  facilities: string[];
  /**
   * @deprecated Legacy hardcoded boolean map. Retained for read-path back-compat
   * only — new writes set `facilities` instead. Will be dropped once all
   * records have been re-saved through the unified form.
   */
  services?: MosqueServices;
  languages: string[];
  // Prayer-time config
  prayerCalc?: PrayerCalcConfig;
  // Media
  coverImage?: MosqueImage;
  gallery?: MosqueImage[];
  logoUrl?: string;
  /** Storage path for `logoUrl`, retained so the upload UI can clean up the
   *  previous blob when the admin replaces the logo. */
  logoStoragePath?: string;
  // Provenance / moderation
  submittedBy?: { uid?: string; email?: string };
  moderation?: MosqueModeration;
  /**
   * Firebase Auth uids of users who can manage this mosque (currently: create
   * events linked to it). Assigned by site admins after off-platform identity
   * verification. One user may manage multiple mosques.
   */
  managers?: string[];
  // Search
  searchTokens: string[];
  altSpellings?: string[];
  // Stats
  stats?: MosqueStats;
  // Timestamps (ISO strings on the wire — server normalizes Firestore Timestamps)
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

/**
 * Admin-managed facility taxonomy. Each Mosque references zero or more by
 * slug. Names are English-only — non-English UI locales fall back to the
 * English label at render time, matching the rest of the mosque domain.
 */
export interface MosqueFacility {
  id: string;
  slug: string;
  name: string;
  iconKey?: string;
  sortOrder: number;
}

export type MosqueSource = "firestore" | "mock";

export interface MosqueListResult {
  mosques: Mosque[];
  source: MosqueSource;
  total?: number;
}

export interface MosqueFilters {
  q?: string;
  country?: string;
  city?: string;
  citySlug?: string;
  countrySlug?: string;
  denomination?: Denomination;
  /** Slugs into the mosqueFacilities taxonomy. */
  facilities?: string[];
  near?: { lat: number; lng: number; radiusKm: number };
  limit?: number;
}
