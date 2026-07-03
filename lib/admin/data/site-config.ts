import "server-only";
import { cache } from "react";
import { unstable_cache, revalidateTag } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { getDb, requireDb } from "@/lib/firebase/admin";
import { publicUrlFor, type SiteUploadKind } from "@/lib/site-config/storage";
import {
  BODY_FONT_OPTIONS,
  ARABIC_FONT_OPTIONS,
  DEFAULT_BODY_FONT,
  DEFAULT_ARABIC_FONT,
  type BodyFont,
  type ArabicFont,
} from "@/lib/site-config/typography";

// Re-export the shared constants/types so existing call sites that import
// these from `@/lib/admin/data/site-config` keep compiling.
export {
  BODY_FONT_OPTIONS,
  ARABIC_FONT_OPTIONS,
  DEFAULT_BODY_FONT,
  DEFAULT_ARABIC_FONT,
};
export type { BodyFont, ArabicFont };

export const SITE_CONFIG_COLLECTION = "config";
export const SITE_CONFIG_DOC = "site";

export const DEFAULT_SITE_NAME = "i-muslim";

export interface SiteConfig {
  siteName: string;
  tagline: string;
  logoStoragePath: string | null;
  logoUrl: string | null;
  faviconStoragePath: string | null;
  faviconUrl: string | null;
  ogImageStoragePath: string | null;
  ogImageUrl: string | null;
  articlePlaceholderStoragePath: string | null;
  articlePlaceholderUrl: string | null;
  bodyFont: BodyFont;
  arabicFont: ArabicFont;
}

function emptyConfig(): SiteConfig {
  return {
    siteName: DEFAULT_SITE_NAME,
    tagline: "",
    logoStoragePath: null,
    logoUrl: null,
    faviconStoragePath: null,
    faviconUrl: null,
    ogImageStoragePath: null,
    ogImageUrl: null,
    articlePlaceholderStoragePath: null,
    articlePlaceholderUrl: null,
    bodyFont: DEFAULT_BODY_FONT,
    arabicFont: DEFAULT_ARABIC_FONT,
  };
}

function bodyFontField(raw: unknown): BodyFont {
  return typeof raw === "string" && (BODY_FONT_OPTIONS as readonly string[]).includes(raw)
    ? (raw as BodyFont)
    : DEFAULT_BODY_FONT;
}

function arabicFontField(raw: unknown): ArabicFont {
  return typeof raw === "string" && (ARABIC_FONT_OPTIONS as readonly string[]).includes(raw)
    ? (raw as ArabicFont)
    : DEFAULT_ARABIC_FONT;
}

function pathField(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function urlFor(path: string | null): string | null {
  return path ? publicUrlFor(path) : null;
}

function shapeFromData(data: Record<string, unknown>): SiteConfig {
  const logoStoragePath = pathField(data.logoStoragePath);
  const faviconStoragePath = pathField(data.faviconStoragePath);
  const ogImageStoragePath = pathField(data.ogImageStoragePath);
  const articlePlaceholderStoragePath = pathField(data.articlePlaceholderStoragePath);
  const siteName =
    typeof data.siteName === "string" && data.siteName.trim().length > 0
      ? data.siteName.trim()
      : DEFAULT_SITE_NAME;
  const tagline = typeof data.tagline === "string" ? data.tagline.trim() : "";
  return {
    siteName,
    tagline,
    logoStoragePath,
    logoUrl: urlFor(logoStoragePath),
    faviconStoragePath,
    faviconUrl: urlFor(faviconStoragePath),
    ogImageStoragePath,
    ogImageUrl: urlFor(ogImageStoragePath),
    articlePlaceholderStoragePath,
    articlePlaceholderUrl: urlFor(articlePlaceholderStoragePath),
    bodyFont: bodyFontField(data.bodyFont),
    arabicFont: arabicFontField(data.arabicFont),
  };
}

async function readSiteConfig(): Promise<SiteConfig> {
  const db = getDb();
  if (!db) return emptyConfig();
  try {
    const snap = await db
      .collection(SITE_CONFIG_COLLECTION)
      .doc(SITE_CONFIG_DOC)
      .get();
    if (!snap.exists) return emptyConfig();
    return shapeFromData(snap.data() ?? {});
  } catch (err) {
    console.warn("[admin/data/site-config] read failed:", err);
    return emptyConfig();
  }
}

// `config/site` changes only on rare admin edits, yet the root layout reads it
// on every request. Cache it in the cross-request Data Cache (invalidated on
// write via `revalidateSiteConfig`); the TTL is only a fallback for out-of-band
// writes. Wrapped again in React `cache` so the multiple RSCs in one render
// (root layout, admin layout, Nav, Footer) still share a single call.
export const SITE_CONFIG_TAG = "config:site";

const cachedReadSiteConfig = unstable_cache(readSiteConfig, ["admin:site-config"], {
  revalidate: 60 * 60, // 1 hour fallback; admin writes invalidate immediately
  tags: [SITE_CONFIG_TAG],
});

export const getSiteConfig = cache(cachedReadSiteConfig);

// Call from admin write actions after mutating `config/site` so the next public
// read reflects the change without waiting for the TTL.
export function revalidateSiteConfig(): void {
  revalidateTag(SITE_CONFIG_TAG, { expire: 0 });
}

export interface SiteIdentityInput {
  siteName: string;
  tagline: string;
}

export async function setSiteIdentity(
  input: SiteIdentityInput,
  adminEmail: string,
): Promise<SiteConfig> {
  const db = requireDb();
  await db
    .collection(SITE_CONFIG_COLLECTION)
    .doc(SITE_CONFIG_DOC)
    .set(
      {
        siteName: input.siteName.trim() || DEFAULT_SITE_NAME,
        tagline: input.tagline.trim(),
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail,
      },
      { merge: true },
    );
  return readSiteConfig();
}

const KIND_TO_PATH_FIELD: Record<SiteUploadKind, string> = {
  logo: "logoStoragePath",
  favicon: "faviconStoragePath",
  og: "ogImageStoragePath",
  articlePlaceholder: "articlePlaceholderStoragePath",
};

export interface SetSiteAssetInput {
  kind: SiteUploadKind;
  storagePath: string | null;
}

export interface SiteTypographyInput {
  bodyFont: BodyFont;
  arabicFont: ArabicFont;
}

export async function setSiteTypography(
  input: SiteTypographyInput,
  adminEmail: string,
): Promise<SiteConfig> {
  const db = requireDb();
  await db
    .collection(SITE_CONFIG_COLLECTION)
    .doc(SITE_CONFIG_DOC)
    .set(
      {
        bodyFont: input.bodyFont,
        arabicFont: input.arabicFont,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail,
      },
      { merge: true },
    );
  return readSiteConfig();
}

export async function setSiteAsset(
  input: SetSiteAssetInput,
  adminEmail: string,
): Promise<SiteConfig> {
  const db = requireDb();
  const fieldName = KIND_TO_PATH_FIELD[input.kind];
  await db
    .collection(SITE_CONFIG_COLLECTION)
    .doc(SITE_CONFIG_DOC)
    .set(
      {
        [fieldName]: input.storagePath,
        updatedAt: Timestamp.now(),
        updatedBy: adminEmail,
      },
      { merge: true },
    );
  return readSiteConfig();
}
