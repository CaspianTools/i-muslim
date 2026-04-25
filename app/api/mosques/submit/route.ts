import { NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { MOSQUE_SUBMISSIONS_COLLECTION, emptyServices } from "@/lib/mosques/constants";
import { defaultPrayerCalc } from "@/lib/mosques/adhan";
import { verifyTurnstile } from "@/lib/mosques/turnstile";

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
  submitterEmail: z.string().email(),
  website_url_secondary: z.string().optional(), // honeypot
  turnstileToken: z.string().optional(),
});

const RATE_LIMIT_PER_DAY = 5;

export async function POST(req: Request) {
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

  // Rate limit per IP per day.
  const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  try {
    const recent = await db
      .collection(MOSQUE_SUBMISSIONS_COLLECTION)
      .where("submitterIp", "==", ip)
      .where("createdAt", ">", since)
      .count()
      .get();
    if (recent.data().count >= RATE_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
  } catch {
    // count() requires composite index; if missing, skip rate limit rather than block submission.
  }

  const payload = {
    name: { en: data.nameEn.trim(), ...(data.nameAr ? { ar: data.nameAr.trim() } : {}) },
    denomination: data.denomination,
    address: { line1: data.addressLine1.trim() },
    city: data.city.trim(),
    country: data.country.toUpperCase(),
    location: { lat: 0, lng: 0 }, // admin will geocode + set on promote
    timezone: "UTC",
    contact: {
      phone: data.phone || undefined,
      website: data.website || undefined,
      email: data.email || undefined,
    },
    services: emptyServices(),
    languages: [],
    prayerCalc: defaultPrayerCalc(),
    description: data.description ? { en: data.description.trim() } : undefined,
  };

  const docRef = await db.collection(MOSQUE_SUBMISSIONS_COLLECTION).add({
    status: "pending_review",
    payload,
    submittedBy: { email: data.submitterEmail },
    submitterIp: ip,
    createdAt: Timestamp.now(),
  });
  return NextResponse.json({ ok: true, id: docRef.id });
}
