import { z } from "zod";
import { BUNDLED_LOCALES } from "@/i18n/config";

// Authored taxonomy content (categories, amenities, cert bodies) is translated
// only into the bundled UI locales. Reserved/un-activated locales render with
// English fallback at the call site via lib/utils.ts pickLocalized().
const localizedRequired = z.object(
  Object.fromEntries(BUNDLED_LOCALES.map((l) => [l, z.string().min(1)])) as Record<
    (typeof BUNDLED_LOCALES)[number],
    z.ZodString
  >,
);

const partialLocalized = z.object({
  en: z.string().min(1, "English description is required"),
  ar: z.string().optional(),
  tr: z.string().optional(),
  id: z.string().optional(),
});

const halalStatusEnum = z.enum(["certified", "self_declared", "muslim_owned", "unverified"]);
const businessStatusEnum = z.enum(["draft", "published", "archived"]);
const priceTierSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const optionalUrl = z
  .union([z.string().url(), z.literal("")])
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalString = z
  .union([z.string(), z.literal("")])
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm");

const hoursEntry = z.object({ open: hhmm, close: hhmm }).nullable();

const hoursSchema = z.object({
  mon: hoursEntry,
  tue: hoursEntry,
  wed: hoursEntry,
  thu: hoursEntry,
  fri: hoursEntry,
  sat: hoursEntry,
  sun: hoursEntry,
  notes: optionalString,
});

const addressSchema = z.object({
  line1: z.string().min(2),
  city: z.string().min(1),
  region: optionalString,
  countryCode: z.string().length(2).toUpperCase(),
  postalCode: optionalString,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const contactSchema = z.object({
  phone: optionalString,
  email: z.union([z.string().email(), z.literal("")]).optional().transform((v) => (v ? v : undefined)),
  website: optionalUrl,
  instagram: optionalString,
  whatsapp: optionalString,
});

const halalSchema = z
  .object({
    status: halalStatusEnum,
    certificationBodyId: optionalString,
    certificationNumber: optionalString,
    expiresAt: optionalString,
  })
  .refine(
    (v) => v.status !== "certified" || !!v.certificationBodyId,
    { message: "Certification body is required for certified status", path: ["certificationBodyId"] },
  );

const photoSchema = z.object({
  storagePath: z.string().min(1),
  alt: optionalString,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const businessInputSchema = z.object({
  status: businessStatusEnum,
  name: z.string().min(2).max(120),
  description: partialLocalized,
  categoryIds: z.array(z.string().min(1)).min(1, "Pick at least one category"),
  halal: halalSchema,
  muslimOwned: z.boolean(),
  platformVerifiedAt: optionalString,
  contact: contactSchema,
  address: addressSchema,
  hours: hoursSchema,
  amenityIds: z.array(z.string().min(1)).default([]),
  priceTier: priceTierSchema.optional(),
  photos: z.array(photoSchema).max(6, "Max 6 photos").default([]),
  ownerEmail: z.union([z.string().email(), z.literal("")]).optional().transform((v) => (v ? v : undefined)),
});

export type BusinessInput = z.infer<typeof businessInputSchema>;

export const categoryInputSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "lowercase letters, digits, hyphens"),
  name: localizedRequired,
  iconKey: optionalString,
  sortOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const amenityInputSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: localizedRequired,
  iconKey: optionalString,
});
export type AmenityInput = z.infer<typeof amenityInputSchema>;

export const certBodyInputSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  country: z.string().length(2).toUpperCase(),
  website: optionalUrl,
  logoStoragePath: optionalString,
  verifiedByPlatform: z.boolean().default(false),
});
export type CertBodyInput = z.infer<typeof certBodyInputSchema>;

// Schema for public, non-admin submissions of new halal businesses.
// Admin reviews each submission, geocodes the address, and promotes it
// to a draft `businesses` doc that they can finish editing/publishing.
export const businessSubmissionSchema = z.object({
  name: z.string().min(2).max(120),
  descriptionEn: z.string().min(10).max(2000),
  categoryIds: z.array(z.string().min(1)).min(1).max(3),
  halalStatus: halalStatusEnum,
  certificationBodyName: optionalString,
  muslimOwned: z.boolean().default(false),
  addressLine1: z.string().min(2),
  city: z.string().min(1),
  region: optionalString,
  countryCode: z.string().length(2).toUpperCase(),
  postalCode: optionalString,
  phone: optionalString,
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  website: optionalUrl,
  instagram: optionalString,
  whatsapp: optionalString,
  submitterEmail: z.string().email(),
  isOwner: z.boolean().default(false),
  // honeypot — must be empty
  website_url_secondary: z.string().optional(),
  turnstileToken: z.string().optional(),
});
export type BusinessSubmissionInput = z.infer<typeof businessSubmissionSchema>;

const reportReasonEnum = z.enum(["not_halal", "closed", "wrong_info", "offensive", "duplicate", "other"]);

export const reportInputSchema = z.object({
  businessId: z.string().min(1),
  reason: reportReasonEnum,
  note: z.string().max(1000).optional(),
  reporterEmail: z.union([z.string().email(), z.literal("")]).optional().transform((v) => (v ? v : undefined)),
});
export type ReportInput = z.infer<typeof reportInputSchema>;
