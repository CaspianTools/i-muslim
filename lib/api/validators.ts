import { z } from "zod";
import { API_PERMISSIONS, API_SCOPES } from "@/types/api";
import { ALL_LANGS } from "@/lib/translations";

const NON_AR_LANGS = ALL_LANGS.filter((l) => l !== "ar");

export const ApiScopeSchema = z.enum(API_SCOPES);
export const ApiPermissionSchema = z.enum(API_PERMISSIONS);

export const CreateApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    scopes: z.array(ApiScopeSchema).min(1).max(API_SCOPES.length),
    permissions: z.array(ApiPermissionSchema).min(1).max(API_PERMISSIONS.length),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((v) => (v ? new Date(v) : null)),
  })
  .strict();

export const PatchApiKeySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    scopes: z.array(ApiScopeSchema).min(1).max(API_SCOPES.length).optional(),
    permissions: z.array(ApiPermissionSchema).min(1).max(API_PERMISSIONS.length).optional(),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === null ? null : new Date(v))),
  })
  .strict();

export const NonArabicLangSchema = z.enum(NON_AR_LANGS as [string, ...string[]]);

export const HadithTranslationPutSchema = z
  .object({
    text: z.string().min(1).max(20000),
  })
  .strict();

export const HadithPatchSchema = z
  .object({
    narrator: z.string().max(500).nullable().optional(),
    grade: z.string().max(200).nullable().optional(),
    tags: z.array(z.string().max(64)).max(50).optional(),
    notes: z.string().max(4000).nullable().optional(),
    published: z.boolean().optional(),
  })
  .strict();

export const QuranTranslationPutSchema = z
  .object({
    text: z.string().min(1).max(8000),
  })
  .strict();

export const QuranAyahPatchSchema = z
  .object({
    tags: z.array(z.string().max(64)).max(50).optional(),
    notes: z.string().max(4000).nullable().optional(),
    published: z.boolean().optional(),
  })
  .strict();

export const MosqueSubmitSchema = z
  .object({
    nameEn: z.string().min(2).max(200),
    nameAr: z.string().max(200).optional(),
    addressLine1: z.string().min(2).max(300),
    city: z.string().min(1).max(120),
    country: z.string().regex(/^[A-Za-z]{2}$/),
    denomination: z
      .enum(["sunni", "shia", "ibadi", "ahmadi", "other", "unspecified"])
      .default("unspecified"),
    phone: z.string().max(60).optional(),
    website: z.string().url().max(500).optional().or(z.literal("")),
    email: z.string().email().max(200).optional().or(z.literal("")),
    description: z.string().max(4000).optional(),
    submitterEmail: z.string().email(),
    languages: z.array(z.string().max(32)).max(20).default([]),
  })
  .strict();
