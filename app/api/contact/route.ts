import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { contactSubmitSchema } from "@/lib/contact/schemas";
import { CONTACT_MESSAGES_COLLECTION } from "@/lib/admin/data/contact-messages";

export const runtime = "nodejs";

const RATE_LIMIT_PER_DAY = 5;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = contactSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid_input" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (data.website_url_secondary && data.website_url_secondary.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? undefined;

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, error: "firestore_not_configured" }, { status: 503 });
  }

  const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  try {
    const recent = await db
      .collection(CONTACT_MESSAGES_COLLECTION)
      .where("submitterIp", "==", ip)
      .where("createdAt", ">", since)
      .count()
      .get();
    if (recent.data().count >= RATE_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
  } catch {
    // count() requires a composite index; if missing, skip rate limit rather than block submissions.
  }

  const docRef = await db.collection(CONTACT_MESSAGES_COLLECTION).add({
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
    status: "open",
    locale: data.locale,
    submitterIp: ip,
    userAgent,
    createdAt: Timestamp.now(),
  });
  return NextResponse.json({ ok: true, id: docRef.id });
}
