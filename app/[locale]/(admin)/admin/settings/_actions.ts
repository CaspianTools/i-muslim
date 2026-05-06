"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth/session";
import {
  LOCALES,
  RESERVED_LOCALES,
  BUNDLED_LOCALES,
  type Locale,
} from "@/i18n/config";
import { ALL_LANGS, type LangCode } from "@/lib/translations";
import {
  setLanguageSettings,
  type LanguageSettings,
} from "@/lib/admin/data/language-settings";
import {
  setUiLocale,
  deactivateUiLocale,
  updateUiLocaleMessages,
  type UiLocaleDoc,
} from "@/lib/admin/data/ui-locales";
import {
  setSiteIdentity,
  setSiteTypography,
  BODY_FONT_OPTIONS,
  ARABIC_FONT_OPTIONS,
  type BodyFont,
  type ArabicFont,
  type SiteConfig,
} from "@/lib/admin/data/site-config";

const inputSchema = z.object({
  uiEnabled: z.array(z.enum(LOCALES as unknown as [Locale, ...Locale[]])),
  quranEnabled: z.array(
    z.enum(ALL_LANGS as unknown as [LangCode, ...LangCode[]]),
  ),
  hadithEnabled: z.array(
    z.enum(ALL_LANGS as unknown as [LangCode, ...LangCode[]]),
  ),
});

export type UpdateLanguageSettingsResult =
  | { ok: true; settings: LanguageSettings }
  | { ok: false; error: string };

export async function updateLanguageSettings(
  rawInput: unknown,
): Promise<UpdateLanguageSettingsResult> {
  const session = await requireAdminSession();
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const settings = await setLanguageSettings(parsed.data, session.email);
    // Public footer + Quran/Hadith pages read this — invalidate broadly.
    revalidatePath("/", "layout");
    return { ok: true, settings };
  } catch (err) {
    console.warn("[admin/settings/_actions] write failed:", err);
    return { ok: false, error: "write-failed" };
  }
}

const reservedLocaleEnum = z.enum(
  RESERVED_LOCALES as unknown as [Locale, ...Locale[]],
);
const baseLocaleEnum = z.enum(
  BUNDLED_LOCALES as unknown as [Locale, ...Locale[]],
);

const activateLocaleSchema = z.object({
  code: reservedLocaleEnum,
  nativeName: z.string().trim().min(1).max(80),
  englishName: z.string().trim().min(1).max(80),
  flag: z.string().trim().min(1).max(10),
  rtl: z.boolean(),
  baseLocale: baseLocaleEnum,
  // Free-form translation tree. We don't validate against the English shape
  // here — i18n/request.ts deep-merges over the base locale, so missing keys
  // just fall back at render time.
  messages: z.record(z.string(), z.unknown()),
});

export type ActivateUiLocaleResult =
  | { ok: true; locale: UiLocaleDoc }
  | { ok: false; error: string };

export async function activateUiLocale(
  rawInput: unknown,
): Promise<ActivateUiLocaleResult> {
  const session = await requireAdminSession();
  const parsed = activateLocaleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const locale = await setUiLocale(parsed.data, session.email);
    revalidatePath("/", "layout");
    return { ok: true, locale };
  } catch (err) {
    console.warn("[admin/settings/_actions] activate failed:", err);
    return { ok: false, error: "write-failed" };
  }
}

export type DeactivateUiLocaleResult =
  | { ok: true }
  | { ok: false; error: string };

const updateMessagesSchema = z.object({
  code: reservedLocaleEnum,
  messages: z.record(z.string(), z.unknown()),
});

export type UpdateUiLocaleMessagesResult =
  | { ok: true; locale: UiLocaleDoc }
  | { ok: false; error: string };

export async function updateUiLocaleMessagesAction(
  rawInput: unknown,
): Promise<UpdateUiLocaleMessagesResult> {
  const session = await requireAdminSession();
  const parsed = updateMessagesSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const locale = await updateUiLocaleMessages(
      parsed.data.code,
      parsed.data.messages,
      session.email,
    );
    revalidatePath("/", "layout");
    return { ok: true, locale };
  } catch (err) {
    console.warn("[admin/settings/_actions] updateMessages failed:", err);
    return { ok: false, error: "write-failed" };
  }
}

const siteIdentitySchema = z.object({
  siteName: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160),
});

export type UpdateSiteIdentityResult =
  | { ok: true; config: SiteConfig }
  | { ok: false; error: string };

export async function updateSiteIdentityAction(
  rawInput: unknown,
): Promise<UpdateSiteIdentityResult> {
  const session = await requireAdminSession();
  const parsed = siteIdentitySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const config = await setSiteIdentity(parsed.data, session.email);
    // Title and metadata read from this in the root layout — invalidate broadly.
    revalidatePath("/", "layout");
    return { ok: true, config };
  } catch (err) {
    console.warn("[admin/settings/_actions] updateSiteIdentity failed:", err);
    return { ok: false, error: "write-failed" };
  }
}

const typographySchema = z.object({
  bodyFont: z.enum(BODY_FONT_OPTIONS as unknown as [BodyFont, ...BodyFont[]]),
  arabicFont: z.enum(
    ARABIC_FONT_OPTIONS as unknown as [ArabicFont, ...ArabicFont[]],
  ),
});

export type UpdateTypographyResult =
  | { ok: true; config: SiteConfig }
  | { ok: false; error: string };

export async function updateTypographyAction(
  rawInput: unknown,
): Promise<UpdateTypographyResult> {
  const session = await requireAdminSession();
  const parsed = typographySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const config = await setSiteTypography(parsed.data, session.email);
    // Fonts apply at the root layout — invalidate broadly.
    revalidatePath("/", "layout");
    return { ok: true, config };
  } catch (err) {
    console.warn("[admin/settings/_actions] updateTypography failed:", err);
    return { ok: false, error: "write-failed" };
  }
}

export async function deactivateUiLocaleAction(
  code: string,
): Promise<DeactivateUiLocaleResult> {
  const session = await requireAdminSession();
  const parsed = reservedLocaleEnum.safeParse(code);
  if (!parsed.success) {
    return { ok: false, error: "invalid-locale" };
  }
  try {
    await deactivateUiLocale(parsed.data, session.email);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    console.warn("[admin/settings/_actions] deactivate failed:", err);
    return { ok: false, error: "write-failed" };
  }
}
