import "server-only";
import { NextResponse } from "next/server";
import type { TranslationCatalogEntry } from "@/lib/translations/catalog";

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
