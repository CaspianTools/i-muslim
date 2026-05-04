import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { businessSubmissionSchema } from "@/lib/businesses/schemas";
import {
  BUSINESS_SUBMISSIONS_COLLECTION,
  BUSINESS_SUBMISSIONS_RATE_LIMIT_PER_DAY,
} from "@/lib/businesses/constants";
import { verifyTurnstile } from "@/lib/mosques/turnstile";
import { createNotification } from "@/lib/admin/data/notifications";

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
      .where("submittedBy.uid", "==", session.uid)
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
    muslimOwned: data.halalStatus === "muslim_owned",
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
  if (data.geocoded) {
    payload.geocoded = data.geocoded;
  } else if (data.geocoded === null) {
    payload.geocodeFailed = true;
  }

  const docRef = await db.collection(BUSINESS_SUBMISSIONS_COLLECTION).add({
    status: "pending_review",
    payload,
    submittedBy: { uid: session.uid, email: session.email },
    submitterIp: ip,
    createdAt: Timestamp.now(),
  });
  await createNotification({
    type: "submission",
    title: "New business submission",
    body: payload.name as string,
    link: "/admin/businesses/submissions",
    sourceCollection: BUSINESS_SUBMISSIONS_COLLECTION,
    sourceId: docRef.id,
  });
  return NextResponse.json({ ok: true, id: docRef.id });
}
