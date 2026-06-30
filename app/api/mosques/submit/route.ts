import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { MOSQUES_COLLECTION } from "@/lib/mosques/constants";
import { defaultPrayerCalc } from "@/lib/mosques/adhan";
import {
  buildMosqueSlug,
  isReservedSlug,
  slugify,
  withCollisionSuffix,
} from "@/lib/mosques/slug";
import { buildSearchTokens } from "@/lib/mosques/search";
import { verifyTurnstile } from "@/lib/mosques/turnstile";
import { createNotification } from "@/lib/admin/data/notifications";

const schema = z.object({
  nameEn: z.string().min(2),
  nameAr: z.string().optional(),
  addressLine1: z.string().min(2),
  city: z.string().min(1),
  country: z.string().regex(/^[A-Za-z]{2}$/),
  denomination: z.enum(["sunni", "shia", "ibadi", "ahmadi", "other", "unspecified"]).default("unspecified"),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  description: z.string().optional(),
  languages: z.array(z.string()).max(20).default([]),
  prayerCalc: z
    .object({
      method: z.enum(["MWL", "ISNA", "EGYPT", "MAKKAH", "KARACHI", "TEHRAN", "JAFARI"]),
      asrMethod: z.enum(["shafi", "hanafi"]),
      highLatitudeRule: z.enum(["MIDDLE_OF_NIGHT", "ANGLE_BASED", "ONE_SEVENTH"]),
    })
    .optional(),
  website_url_secondary: z.string().optional(), // honeypot
  turnstileToken: z.string().optional(),
});

const RATE_LIMIT_PER_DAY = 5;

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

export async function POST(req: Request) {
  const session = await getSiteSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  if (data.website_url_secondary && data.website_url_secondary.length > 0) {
    // honeypot tripped — pretend success to throw off bots.
    return NextResponse.json({ ok: true });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const turnstile = await verifyTurnstile(data.turnstileToken, ip);
  if (!turnstile.success) {
    return NextResponse.json({ ok: false, error: "turnstile" }, { status: 403 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, error: "firestore_not_configured" }, { status: 503 });
  }

  // Rate limit per uid per day, matching the events + business submit routes.
  // Counts only this user's pending_review docs in the last 24 hours.
  const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  try {
    const recent = await db
      .collection(MOSQUES_COLLECTION)
      .where("submittedBy.uid", "==", session.uid)
      .where("status", "==", "pending_review")
      .where("createdAt", ">", since)
      .count()
      .get();
    if (recent.data().count >= RATE_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
  } catch {
    // count() requires composite index; if missing, skip rate limit rather than block submission.
  }

  // Firestore Admin SDK rejects undefined field values by default, so build the
  // optional pieces conditionally rather than letting them resolve to undefined.
  const contact: { phone?: string; website?: string; email?: string } = {};
  if (data.phone) contact.phone = data.phone;
  if (data.website) contact.website = data.website;
  if (data.email) contact.email = data.email;

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

  const searchTokenSeed = {
    name,
    city,
    country,
    languages: data.languages,
    denomination: data.denomination,
    address: { line1: data.addressLine1.trim() },
  };

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
    location: { lat: 0, lng: 0 }, // admin will geocode + set on review
    geohash: "",
    timezone: "UTC",
    facilities: [],
    languages: data.languages,
    prayerCalc: data.prayerCalc ?? defaultPrayerCalc(),
    submittedBy: { uid: session.uid, email: session.email },
    submitterIp: ip,
    searchTokens: buildSearchTokens(searchTokenSeed),
    createdAt: now,
    updatedAt: now,
  };
  if (Object.keys(contact).length > 0) doc.contact = contact;
  if (data.description) doc.description = { en: data.description.trim() };

  await db.collection(MOSQUES_COLLECTION).doc(slug).set(doc, { merge: false });
  await createNotification({
    type: "submission",
    title: "New mosque submission",
    body: nameEn,
    link: `/admin/mosques?slug=${slug}`,
    sourceCollection: MOSQUES_COLLECTION,
    sourceId: slug,
  });
  return NextResponse.json({ ok: true, slug });
}
