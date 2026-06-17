import "server-only";
import type { Metadata } from "next";
import { BUNDLED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { listActivatedReservedLocales } from "@/lib/admin/data/ui-locales";
import { getSiteConfig } from "@/lib/admin/data/site-config";

// Single source of truth for SEO metadata (canonical, hreflang, Open Graph,
// Twitter). Replaces the `resolveSiteUrl()` helper that was copy-pasted across
// the sitemaps and several page files.

const SITE_NAME = "i-muslim";

// NEXT_PUBLIC_SITE_URL is sometimes set without a scheme (e.g. "i-muslim.com")
// — Google then rejects every absolute URL we emit. Prepend https:// and strip
// any trailing slash so callers can append `/${locale}${path}` cleanly.
function resolveSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "http://localhost:7777";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export const SITE_URL = resolveSiteUrl();

// Set once on the root layout; descendants inherit it so relative URL-based
// metadata fields resolve to absolute. Absolute URLs we build ourselves pass
// through unchanged.
export const metadataBase = new URL(SITE_URL);

/**
 * The locales whose URLs we advertise via hreflang: the always-bundled locales
 * (en, ar, tr, id) plus any reserved locale an admin has activated (so it
 * serves real, non-English content). `current` is folded in to guarantee a
 * self-referencing hreflang even when the active locale is a reserved one.
 */
export async function indexableLocales(current?: Locale): Promise<Locale[]> {
  const activated = await listActivatedReservedLocales();
  const set = new Set<Locale>([...BUNDLED_LOCALES, ...activated]);
  if (current) set.add(current);
  return [...set];
}

export type HreflangAlternates = {
  canonical: string;
  languages: Record<string, string>;
};

/**
 * Build a locale-prefixed map for `alternates.languages` (one entry per
 * indexable locale + `x-default` → default locale). Shared by page metadata
 * and the sitemaps so the two never disagree.
 */
export async function hreflangLanguageMap(
  path: string,
  current?: Locale,
): Promise<Record<string, string>> {
  const locales = await indexableLocales(current);
  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${SITE_URL}/${l}${path}`;
  }
  languages["x-default"] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
  return languages;
}

/**
 * Canonical + hreflang alternates for a locale-prefixed route. `path` is
 * locale-less, with a leading slash and no trailing slash; the site root is ""
 * (canonical becomes `${SITE_URL}/${locale}`).
 */
export async function hreflangAlternates(
  locale: Locale,
  path: string,
): Promise<HreflangAlternates> {
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages: await hreflangLanguageMap(path, locale),
  };
}

export type PageImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

export type BuildPageMetadataInput = {
  locale: Locale;
  /** Locale-less path, leading slash, no trailing slash. Home = "". */
  path: string;
  title?: string;
  description?: string;
  type?: "website" | "article";
  /** Page-specific OG/Twitter image(s). Falls back to the admin og image. */
  images?: PageImage[];
  /** Extra OpenGraph fields merged onto the generated object (e.g. article meta). */
  openGraph?: Record<string, unknown>;
};

/**
 * Complete per-page `Metadata`: canonical + hreflang, a full OpenGraph object
 * and a full Twitter card. Next merges metadata shallowly, so any page that
 * needs OpenGraph must emit the *whole* object — this helper guarantees that,
 * including the admin-configured default share image, so callers never wipe the
 * root defaults with a partial override.
 */
export async function buildPageMetadata({
  locale,
  path,
  title,
  description,
  type = "website",
  images,
  openGraph,
}: BuildPageMetadataInput): Promise<Metadata> {
  const [alternates, locales] = await Promise.all([
    hreflangAlternates(locale, path),
    indexableLocales(locale),
  ]);
  const alternateLocale = locales.filter((l) => l !== locale);

  let resolvedImages = images;
  if (!resolvedImages) {
    const config = await getSiteConfig();
    resolvedImages = config.ogImageUrl
      ? [{ url: config.ogImageUrl, width: 1200, height: 630 }]
      : undefined;
  }
  const hasImage = !!resolvedImages && resolvedImages.length > 0;

  return {
    title,
    description,
    alternates,
    openGraph: {
      type,
      title,
      description,
      url: alternates.canonical,
      siteName: SITE_NAME,
      locale,
      alternateLocale,
      images: resolvedImages,
      ...openGraph,
    },
    twitter: {
      card: hasImage ? "summary_large_image" : "summary",
      title,
      description,
      images: resolvedImages?.map((i) => i.url),
    },
  };
}

/** Metadata for private/utility routes that must not be indexed. */
export function noindexMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}
