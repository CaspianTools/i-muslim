import type { NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { getDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * Public, key-less manifest of installable content bundles for the native
 * mobile client. Reads from a single Firestore doc at `config/bundles` that
 * the bundle-builder script (scripts/build-bundles.ts) maintains after each
 * upload to Firebase Storage. CDN-cached for an hour with a 24h SWR window
 * so the mobile app sees updates within ~1h without hammering Firestore.
 *
 * The shape mirrors `BundleManifest` in the mobile repo:
 *   apps/mobile/src/content/manifest.ts (BundleManifestSchema).
 *
 * If the manifest doc doesn't exist yet (cold environment), returns an
 * empty manifest so the mobile app degrades gracefully — it still has its
 * day-1 embedded bundles regardless.
 */

interface BundleEntry {
  id: string;
  version: number;
  resource: "quran" | "hadith";
  lang: string;
  collection?: string | null;
  label: Record<string, string>;
  sizeBytes: number;
  sha256: string;
  url: string;
  license: string;
  attribution: string;
  redistribute: "full" | "metadata-only";
  requires: string[];
  bundledWithApp: boolean;
}

interface BundleManifestDoc {
  manifestVersion?: number;
  generatedAt?: unknown;
  bundles?: unknown;
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(_req: NextRequest) {
  const db = getDb();
  const fallback = {
    manifestVersion: 0,
    generatedAt: new Date().toISOString(),
    bundles: [] as BundleEntry[],
  };

  if (!db) {
    return withCors(apiOk(fallback, { headers: cacheHeaders() }));
  }

  const snap = await db.collection("config").doc("bundles").get();
  if (!snap.exists) {
    return withCors(apiOk(fallback, { headers: cacheHeaders() }));
  }

  const raw = snap.data() as BundleManifestDoc;
  const generatedAt =
    raw.generatedAt instanceof Timestamp
      ? raw.generatedAt.toDate().toISOString()
      : typeof raw.generatedAt === "string"
        ? raw.generatedAt
        : new Date().toISOString();

  const bundles = Array.isArray(raw.bundles)
    ? raw.bundles
        .map((b) => normalizeBundle(b))
        .filter((b): b is BundleEntry => b !== null)
    : [];

  return withCors(
    apiOk(
      {
        manifestVersion: typeof raw.manifestVersion === "number" ? raw.manifestVersion : 0,
        generatedAt,
        bundles,
      },
      { headers: cacheHeaders() },
    ),
  );
}

function cacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  };
}

function normalizeBundle(raw: unknown): BundleEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) return null;
  if (typeof r.version !== "number") return null;
  if (r.resource !== "quran" && r.resource !== "hadith") return null;
  if (typeof r.lang !== "string") return null;
  if (typeof r.sizeBytes !== "number") return null;
  if (typeof r.sha256 !== "string" || r.sha256.length !== 64) return null;
  if (typeof r.url !== "string") return null;
  if (r.redistribute !== "full" && r.redistribute !== "metadata-only") return null;

  return {
    id: r.id,
    version: r.version,
    resource: r.resource,
    lang: r.lang,
    collection: typeof r.collection === "string" ? r.collection : null,
    label: normalizeLabel(r.label),
    sizeBytes: r.sizeBytes,
    sha256: r.sha256,
    url: r.url,
    license: typeof r.license === "string" ? r.license : "Unknown",
    attribution: typeof r.attribution === "string" ? r.attribution : "",
    redistribute: r.redistribute,
    requires: normalizeStringArray(r.requires),
    bundledWithApp: Boolean(r.bundledWithApp),
  };
}

function normalizeLabel(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}
