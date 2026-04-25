export type Gender = "male" | "female";

export type Madhhab = "hanafi" | "maliki" | "shafii" | "hanbali" | "other" | "none";

export type Sect = "sunni" | "shia" | "other";

export type PrayerCommitment =
  | "always"
  | "mostly"
  | "sometimes"
  | "rarely"
  | "learning";

export type HijabStyle = "niqab" | "khimar" | "shayla" | "none" | "na";

export type BeardStatus = "full" | "trimmed" | "none" | "na";

export type PolygamyStance = "open" | "neutral" | "closed" | "na";

export type MaritalHistory = "never_married" | "divorced" | "widowed";

export type EducationLevel =
  | "high_school"
  | "diploma"
  | "bachelor"
  | "master"
  | "phd"
  | "other";

export type ChildrenWish = "yes" | "no" | "maybe";

export type ProfileStatus =
  | "draft"
  | "pending"
  | "active"
  | "suspended"
  | "hidden";

export type SubscriptionTier = "free" | "premium";

export type PhotoVisibility = "match_only" | "public";

export interface MatrimonialPhoto {
  id: string;
  url: string;
  visibility: PhotoVisibility;
  uploadedAt: string;
}

export interface MatrimonialPreferences {
  lookingForGender: Gender;
  ageMin: number;
  ageMax: number;
  countries: string[];
  locationRadiusKm: number | null;
  madhhabs: Madhhab[];
  sects: Sect[];
  prayerMin: PrayerCommitment;
  polygamyAcceptable: boolean;
}

export interface MatrimonialVerification {
  emailVerified: boolean;
  phoneVerified: boolean;
  photoVerified: boolean;
  idVerified: boolean;
}

export interface MatrimonialSubscription {
  tier: SubscriptionTier;
  expiresAt: string | null;
}

export interface MatrimonialRateLimit {
  dailyInterestsUsed: number;
  dailyInterestsResetAt: string;
}

export interface MatrimonialProfile {
  id: string;
  userId: string;
  displayName: string;
  gender: Gender;
  dateOfBirth: string;
  country: string;
  city: string;
  ethnicity: string | null;
  languages: string[];

  madhhab: Madhhab;
  sect: Sect;
  prayerCommitment: PrayerCommitment;
  hijab: HijabStyle;
  beard: BeardStatus;
  revert: boolean;
  polygamyStance: PolygamyStance;
  maritalHistory: MaritalHistory;
  hasChildren: boolean;
  wantsChildren: ChildrenWish;

  education: EducationLevel;
  profession: string | null;

  preferences: MatrimonialPreferences;

  bio: string;
  photos: MatrimonialPhoto[];

  status: ProfileStatus;
  verification: MatrimonialVerification;

  subscription: MatrimonialSubscription;
  rateLimit: MatrimonialRateLimit;

  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export type InterestStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface MatrimonialInterest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: InterestStatus;
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export type ReportReason =
  | "fake"
  | "harassment"
  | "inappropriate_photo"
  | "non_muslim"
  | "scam"
  | "other";

export type ReportStatus = "open" | "resolved" | "dismissed";

export interface MatrimonialReport {
  id: string;
  reporterUserId: string;
  targetUserId: string;
  reason: ReportReason;
  notes: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface MatrimonialFilters {
  q?: string;
  gender?: Gender;
  status?: ProfileStatus;
  country?: string;
  verifiedOnly?: boolean;
  ageMin?: number;
  ageMax?: number;
  madhhab?: Madhhab;
}

export interface MatrimonialStats {
  activeProfiles: number;
  pendingProfiles: number;
  matchesThisWeek: number;
  openReports: number;
  growth30d: Array<{ date: string; profiles: number }>;
}
