export type LocalizedString = {
  en: string;
  ar?: string;
  tr?: string;
  id?: string;
};

export type MosqueStatus = "draft" | "pending_review" | "published" | "suspended";

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

export type IqamahRule =
  | { mode: "offset"; minutesAfterAdhan: number }
  | { mode: "fixed"; time: string }; // "HH:mm" local

export type IqamahMap = Partial<Record<PrayerKey, IqamahRule>>;

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
  services: MosqueServices;
  languages: string[];
  // Prayer-time config
  prayerCalc?: PrayerCalcConfig;
  iqamah?: IqamahMap;
  // Media
  coverImage?: MosqueImage;
  gallery?: MosqueImage[];
  logoUrl?: string;
  // Provenance / moderation
  submittedBy?: { uid?: string; email?: string };
  moderation?: MosqueModeration;
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

// Public submission — superset of input; not yet a published Mosque.
export interface MosqueSubmission {
  id: string;
  status: "pending_review" | "approved" | "rejected";
  payload: Omit<
    Mosque,
    "slug" | "status" | "createdAt" | "updatedAt" | "publishedAt" | "searchTokens" | "geohash" | "citySlug" | "countrySlug"
  > & {
    proposedSlug?: string;
  };
  submittedBy: { uid?: string; email?: string };
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  rejectionReason?: string;
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
  services?: Array<keyof MosqueServices>;
  near?: { lat: number; lng: number; radiusKm: number };
  limit?: number;
}
