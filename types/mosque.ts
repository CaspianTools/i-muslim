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
  | "suspended"
  // Approved claim/registration that a manager is still filling in. Not yet
  // public — the manager flips it to "published" via the go-live gate once the
  // essentials (logo, about, location) are present.
  | "claimed_draft";

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
  instagram?: string;
  facebook?: string;
  youtube?: string;
  x?: string;
  tiktok?: string;
  telegram?: string;
  whatsapp?: string;
  website?: string;
}

/** Platform keys offered in the manager's social-links editor, in display order. */
export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "youtube",
  "x",
  "tiktok",
  "telegram",
  "whatsapp",
  "website",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

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

/**
 * Manager-set weekly opening hours. Keyed by day-of-week index (0=Sunday .. 6=
 * Saturday). `null` means closed that day; a missing key means "not specified".
 * Times are "HH:mm" in the mosque's local timezone.
 */
export type MosqueOpeningHours = Record<
  number,
  { open: string; close: string } | null
>;

/**
 * Manager-set Iqamah / Jama'ah times — the congregation start times, which
 * differ from the calculated adhan times. Daily prayers are a single "HH:mm"
 * local string; Jumu'ah can have one or more khutbah start times.
 */
export interface MosqueIqamah {
  fajr?: string;
  dhuhr?: string;
  asr?: string;
  maghrib?: string;
  isha?: string;
  jumuah?: string[];
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
  logoUrl?: string;
  /** Storage path for `logoUrl`, retained so the upload UI can clean up the
   *  previous blob when the admin replaces the logo. */
  logoStoragePath?: string;
  // Provenance / moderation
  submittedBy?: { uid?: string; email?: string };
  moderation?: MosqueModeration;
  /**
   * Firebase Auth uids of users who can manage this mosque: edit the page
   * inline, post news, set Iqamah times, and create events linked to it.
   * Assigned by site admins via the claim/registration review flow. v1 keeps a
   * single manager per mosque (length 0 or 1).
   */
  managers?: string[];
  // Manager self-service (claimed pages)
  /** Random short code → bare public page at `/m/<shortCode>`. */
  shortCode?: string;
  /** Single-language manager-authored "about" text, shown on the masjid page.
   *  Distinct from the localized `description` used by the admin/directory. */
  about?: string;
  openingHours?: MosqueOpeningHours;
  iqamah?: MosqueIqamah;
  /** Denormalized count of followers (see the `mosqueFollows` collection). */
  followerCount?: number;
  /** Denormalized count of masjid-level likes (see the `mosqueLikes` collection). */
  likeCount?: number;
  /** Denormalized count of visible news posts. */
  newsCount?: number;
  /** Admin-only "verified" identity badge. Managers cannot set this. */
  verifiedBadge?: boolean;
  /** Who currently manages the page (set at approval; single manager in v1). */
  claimedBy?: { uid: string; email: string; at: string };
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
