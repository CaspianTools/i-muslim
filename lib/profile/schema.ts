import { z } from "zod";

// ISO-3166 alpha-2: two uppercase letters. Empty allowed during partial saves
// (the form will block submission if required) — keeps backfill flows lenient.
const countryCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, "Pick a country")
  .or(z.literal(""));

// Identity + deen fields — the unified profile, used everywhere on the site
// (event RSVPs, mosque submissions, matrimonial display, etc.).
export const profileFieldsSchema = z.object({
  displayName: z.string().min(2).max(60),
  gender: z.enum(["male", "female"]),
  dateOfBirth: z.string().min(8),
  country: countryCodeSchema,
  city: z.string().min(1).max(60),
  ethnicity: z.string().max(60).optional().or(z.literal("")),
  // Lenient on values: legacy free-text entries are kept as-is per mus-1194
  // "no migration" decision; the LanguageCombobox UI guarantees valid ISO-639-1
  // codes for new writes.
  languages: z.array(z.string()).max(20),
  madhhab: z.enum(["hanafi", "maliki", "shafii", "hanbali", "other", "none"]),
  sect: z.enum(["sunni", "shia", "other"]),
  prayerCommitment: z.enum(["always", "mostly", "sometimes", "rarely", "learning"]),
  hijab: z.enum(["niqab", "khimar", "shayla", "none", "na"]),
  beard: z.enum(["full", "trimmed", "none", "na"]),
  revert: z.boolean(),
  education: z.enum(["high_school", "diploma", "bachelor", "master", "phd", "other"]),
  profession: z.string().max(80).optional().or(z.literal("")),
  maritalHistory: z.enum(["never_married", "divorced", "widowed"]),
  hasChildren: z.boolean(),
  wantsChildren: z.enum(["yes", "no", "maybe"]),
  bio: z.string().min(50).max(800),
});

export type ProfileFieldsInput = z.infer<typeof profileFieldsSchema>;

// Matrimonial-only fields — required only when the user enables matrimonial.
// Identity+deen is read from the profile fields above, so the matrimonial
// doc stores nothing identity-related except a denormalized displayName for
// listing performance.
export const matrimonialFieldsSchema = z
  .object({
    polygamyStance: z.enum(["open", "neutral", "closed", "na"]),
    lookingForGender: z.enum(["male", "female"]),
    ageMin: z.number().int().min(18).max(99),
    ageMax: z.number().int().min(18).max(99),
    preferredCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(50),
    preferredMadhhabs: z
      .array(z.enum(["hanafi", "maliki", "shafii", "hanbali", "other", "none"]))
      .max(6),
    prayerMin: z.enum(["always", "mostly", "sometimes", "rarely", "learning"]),
    polygamyAcceptable: z.enum(["open", "neutral", "closed", "na"]),
    photoStubs: z.array(z.string().url()).max(6),
  })
  .refine((v) => v.ageMax >= v.ageMin, {
    message: "Maximum age must be greater than or equal to minimum.",
    path: ["ageMax"],
  });

export type MatrimonialFieldsInput = z.infer<typeof matrimonialFieldsSchema>;

// CSV → trimmed list, used for languages / preferred countries / madhhabs.
export function csvToList(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// The shape persisted under users/{uid}.profile (Firestore-friendly: lists
// are arrays, dates are ISO strings).
export interface ProfileFieldsRecord {
  displayName: string;
  gender: "male" | "female";
  dateOfBirth: string;
  country: string;
  city: string;
  ethnicity: string | null;
  languages: string[];
  madhhab: ProfileFieldsInput["madhhab"];
  sect: ProfileFieldsInput["sect"];
  prayerCommitment: ProfileFieldsInput["prayerCommitment"];
  hijab: ProfileFieldsInput["hijab"];
  beard: ProfileFieldsInput["beard"];
  revert: boolean;
  education: ProfileFieldsInput["education"];
  profession: string | null;
  maritalHistory: ProfileFieldsInput["maritalHistory"];
  hasChildren: boolean;
  wantsChildren: ProfileFieldsInput["wantsChildren"];
  bio: string;
  updatedAt: string;
}

export function inputToRecord(input: ProfileFieldsInput): Omit<ProfileFieldsRecord, "updatedAt"> {
  return {
    displayName: input.displayName,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth,
    country: input.country,
    city: input.city,
    ethnicity: input.ethnicity ? input.ethnicity : null,
    languages: input.languages,
    madhhab: input.madhhab,
    sect: input.sect,
    prayerCommitment: input.prayerCommitment,
    hijab: input.hijab,
    beard: input.beard,
    revert: input.revert,
    education: input.education,
    profession: input.profession ? input.profession : null,
    maritalHistory: input.maritalHistory,
    hasChildren: input.hasChildren,
    wantsChildren: input.wantsChildren,
    bio: input.bio,
  };
}
