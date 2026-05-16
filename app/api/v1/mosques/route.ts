import type { NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { fetchPublishedMosques } from "@/lib/admin/data/mosques";
import { parseNearParam } from "@/lib/mosques/geo";
import { requireDb } from "@/lib/firebase/admin";
import { MOSQUE_SUBMISSIONS_COLLECTION, emptyServices } from "@/lib/mosques/constants";
import { defaultPrayerCalc } from "@/lib/mosques/adhan";
import { MosqueSubmitSchema } from "@/lib/api/validators";
import { writeApiAuditLog } from "@/lib/api/audit";
import type { Mosque } from "@/types/mosque";

export const runtime = "nodejs";

function publicShape(m: Mosque) {
  return {
    slug: m.slug,
    name: m.name,
    denomination: m.denomination,
    address: m.address,
    city: m.city,
    country: m.country,
    location: m.location,
    timezone: m.timezone,
    contact: m.contact,
    services: m.services,
    languages: m.languages,
  };
}

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req, "mosques", "read");
  if (!auth.authenticated) return withCors(auth.error);

  const url = new URL(req.url);
  const near = parseNearParam(url.searchParams.get("near") ?? undefined);
  const limitRaw = Number(url.searchParams.get("limit") ?? "25");
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 25));
  const country = url.searchParams.get("country") ?? undefined;
  const city = url.searchParams.get("city") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const { mosques, total } = await fetchPublishedMosques({
    near: near ?? undefined,
    limit,
    country,
    city,
    q,
  });

  return withCors(
    apiOk(
      {
        total,
        mosques: mosques.map(publicShape),
        ...(near ? { near } : {}),
      },
      { headers: rateLimitHeaders(auth.rateLimit) },
    ),
  );
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req, "mosques", "write");
  if (!auth.authenticated) return auth.error;

  const headers = rateLimitHeaders(auth.rateLimit);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON", 400, headers);
  }
  const parsed = MosqueSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid body",
      400,
      headers,
    );
  }
  const data = parsed.data;

  const payload = {
    name: { en: data.nameEn.trim(), ...(data.nameAr ? { ar: data.nameAr.trim() } : {}) },
    denomination: data.denomination,
    address: { line1: data.addressLine1.trim() },
    city: data.city.trim(),
    country: data.country.toUpperCase(),
    location: { lat: 0, lng: 0 },
    timezone: "UTC",
    contact: {
      phone: data.phone || undefined,
      website: data.website || undefined,
      email: data.email || undefined,
    },
    services: emptyServices(),
    languages: data.languages,
    prayerCalc: defaultPrayerCalc(),
    description: data.description ? { en: data.description.trim() } : undefined,
  };

  const db = requireDb();
  const docRef = await db.collection(MOSQUE_SUBMISSIONS_COLLECTION).add({
    status: "pending_review",
    payload,
    submittedBy: { email: data.submitterEmail, apiKeyId: auth.keyId, apiKeyName: auth.keyName },
    submitterIp: "api",
    createdAt: Timestamp.now(),
  });

  await writeApiAuditLog({
    actor: { kind: "apiKey", keyId: auth.keyId, keyName: auth.keyName },
    action: "mosque.submission.create",
    resourceType: "mosqueSubmission",
    resourceId: docRef.id,
    after: { name: data.nameEn, city: data.city, country: data.country },
  });

  return apiOk(
    { submission: { id: docRef.id, status: "pending_review" } },
    { status: 201, headers },
  );
}
