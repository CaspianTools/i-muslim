import "server-only";
import { NextResponse } from "next/server";
import {
  IMUSLIM_AUTHORED,
  type TranslationCatalogEntry,
} from "@/lib/translations/catalog";

/**
 * Headers shared by every public translation endpoint. No `X-API-Key` is
 * required (these endpoints are open and cache-friendly), so the CORS allowed
 * header is `Content-Type` only — wider than the rest of v1, by design.
 *
 * `s-maxage` is what Next/Vercel's edge cache honours; `max-age` is the
 * browser hint. `stale-while-revalidate` lets the edge serve stale data while
 * regenerating, which masks Firestore cold reads.
 */
const PUBLIC_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
  "Cache-Control":
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
};

export function publicCorsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}

export function publicJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PUBLIC_HEADERS });
}

export function publicError(
  code: string,
  message: string,
  status: number,
): NextResponse {
  return publicJson({ error: { code, message } }, status);
}

/**
 * Project a catalog entry into the response envelope used by every payload.
 * Keep the snake_case naming consistent with the rest of /api/v1 so consumers
 * don't need to switch styles between endpoints.
 */
export function envelope(entry: TranslationCatalogEntry) {
  return {
    attribution: entry.attribution,
    license: entry.license,
    license_url: entry.licenseUrl ?? null,
    source_url: entry.sourceUrl ?? null,
    source_id: entry.sourceId,
    redistribute: entry.redistribute,
    notice: entry.notice ?? null,
  };
}

/**
 * Decide whether an item's text should appear in the response based on the
 * catalogue entry's `redistribute` mode. Centralised so every endpoint applies
 * the same gate — getting this wrong is the only thing that can really hurt
 * the project legally.
 */
export function gateText(
  entry: TranslationCatalogEntry,
  text: string | null | undefined,
): string | null {
  if (entry.redistribute === "full") return text ?? null;
  return null;
}

/**
 * True ⇔ i-muslim authored or substantively edited this translation. The
 * `editedTranslations[lang]` flag is set by the admin UI when the value
 * diverges from upstream, and by the Hadith v1 PUT endpoint on every write.
 * When true, the public API ships the text under the IMUSLIM_AUTHORED licence
 * (CC0) instead of the upstream catalogue licence.
 */
export function isAuthored(
  doc: { editedTranslations?: Record<string, boolean> },
  lang: string,
): boolean {
  return doc.editedTranslations?.[lang] === true;
}

/**
 * Resolve the catalogue entry that governs a single (doc, lang) — authored if
 * the flag is set, otherwise the upstream entry passed in. Keeps the per-item
 * gating logic identical across endpoints.
 */
export function resolveEntry(
  doc: { editedTranslations?: Record<string, boolean> },
  lang: string,
  upstream: TranslationCatalogEntry,
): TranslationCatalogEntry {
  return isAuthored(doc, lang) ? IMUSLIM_AUTHORED : upstream;
}
