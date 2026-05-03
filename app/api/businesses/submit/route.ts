import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { businessSubmissionSchema } from "@/lib/businesses/schemas";
import {
  BUSINESS_SUBMISSIONS_COLLECTION,
  BUSINESS_SUBMISSIONS_RATE_LIMIT_PER_DAY,
} from "@/lib/businesses/constants";
import { verifyTurnstile } from "@/lib/mosques/turnstile";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = businessSubmissionSchema.safeParse(body);
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

  const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  try {
    const recent = await db
      .collection(BUSINESS_SUBMISSIONS_COLLECTION)
      .where("submitterIp", "==", ip)
      .where("createdAt", ">", since)
      .count()
      .get();
    if (recent.data().count >= BUSINESS_SUBMISSIONS_RATE_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
  } catch {
    // count() needs a composite index; if missing, skip rather than block.
  }

  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    descriptionEn: data.descriptionEn.trim(),
    categoryIds: data.categoryIds,
    halalStatus: data.halalStatus,
    muslimOwned: data.muslimOwned,
    addressLine1: data.addressLine1.trim(),
    city: data.city.trim(),
    countryCode: data.countryCode,
    isOwner: data.isOwner,
  };
  if (data.certificationBodyName) payload.certificationBodyName = data.certificationBodyName;
  if (data.region) payload.region = data.region;
  if (data.postalCode) payload.postalCode = data.postalCode;
  if (data.phone) payload.phone = data.phone;
  if (data.email) payload.email = data.email;
  if (data.website) payload.website = data.website;
  if (data.instagram) payload.instagram = data.instagram;
  if (data.whatsapp) payload.whatsapp = data.whatsapp;

  const docRef = await db.collection(BUSINESS_SUBMISSIONS_COLLECTION).add({
    status: "pending_review",
    payload,
    submittedBy: { email: data.submitterEmail },
    submitterIp: ip,
    createdAt: Timestamp.now(),
  });
  return NextResponse.json({ ok: true, id: docRef.id });
}
