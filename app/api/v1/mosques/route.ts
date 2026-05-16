import type { NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { validateApiKey } from "@/lib/api/auth";
import { rateLimitHeaders } from "@/lib/api/rate-limiter";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { fetchPublishedMosques } from "@/lib/admin/data/mosques";
import { parseNearParam } from "@/lib/mosques/geo";
import { requireDb } from "@/lib/firebase/admin";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { defaultPrayerCalc } from "@/lib/mosques/adhan";
import { buildMosqueSlug, withCollisionSuffix, slugify, isReservedSlug } from "@/lib/mosques/slug";
import { buildSearchTokens } from "@/lib/mosques/search";
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
    facilities: m.facilities ?? [],
    languages: m.languages,
  };
}

async function nextSlug(
  db: FirebaseFirestore.Firestore,
  base: string,
): Promise<string> {
  const taken = new Set<string>();
  if (isReservedSlug(base)) taken.add(base);
  const baseDoc = await db.collection(MOSQUES_COLLECTION).doc(base).get();
  if (baseDoc.exists) taken.add(base);
  for (let i = 2; i <= 5; i += 1) {
    const probe = `${base}-${i}`;
    const d = await db.collection(MOSQUES_COLLECTION).doc(probe).get();
    if (d.exists) taken.add(probe);
  }
  return withCollisionSuffix(base, taken);
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

  const db = requireDb();

  const nameEn = data.nameEn.trim();
  const city = data.city.trim();
  const country = data.country.toUpperCase();
  const citySlug = slugify(city);
  const countrySlug = country.toLowerCase();
  const baseSlug = buildMosqueSlug(nameEn, citySlug);
  const slug = await nextSlug(db, baseSlug);
  const now = Timestamp.now();

  const name: { en: string; ar?: string } = { en: nameEn };
  if (data.nameAr) name.ar = data.nameAr.trim();

  const contact: { phone?: string; website?: string; email?: string } = {};
  if (data.phone) contact.phone = data.phone;
  if (data.website) contact.website = data.website;
  if (data.email) contact.email = data.email;

  const doc: Record<string, unknown> = {
    slug,
    status: "pending_review",
    name,
    denomination: data.denomination,
    address: { line1: data.addressLine1.trim() },
    city,
    citySlug,
    country,
    countrySlug,
    location: { lat: 0, lng: 0 },
    geohash: "",
    timezone: "UTC",
    facilities: [],
    languages: data.languages,
    prayerCalc: defaultPrayerCalc(),
    submittedBy: {
      email: data.submitterEmail,
      apiKeyId: auth.keyId,
      apiKeyName: auth.keyName,
    },
    submitterIp: "api",
    searchTokens: buildSearchTokens({
      name,
      city,
      country,
      languages: data.languages,
      denomination: data.denomination,
      address: { line1: data.addressLine1.trim() },
    }),
    createdAt: now,
    updatedAt: now,
  };
  if (Object.keys(contact).length > 0) doc.contact = contact;
  if (data.description) doc.description = { en: data.description.trim() };

  await db.collection(MOSQUES_COLLECTION).doc(slug).set(doc, { merge: false });

  await writeApiAuditLog({
    actor: { kind: "apiKey", keyId: auth.keyId, keyName: auth.keyName },
    action: "mosque.submission.create",
    resourceType: "mosque",
    resourceId: slug,
    after: { name: nameEn, city, country, status: "pending_review" },
  });

  return apiOk(
    { mosque: { slug, status: "pending_review" } },
    { status: 201, headers },
  );
}
