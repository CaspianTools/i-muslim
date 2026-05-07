import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import { getSiteSession } from "@/lib/auth/session";
import { eventSubmitSchema } from "@/lib/events/submit-schema";
import { fetchEventCategories } from "@/lib/admin/data/event-categories";
import { createNotification } from "@/lib/admin/data/notifications";
import { buildRRule } from "@/lib/admin/recurrence";
import { canManageMosque } from "@/lib/mosques/authz";

export const runtime = "nodejs";

const EVENTS_COLLECTION = "events";
const RATE_LIMIT_PER_DAY = 5;

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

  const parsed = eventSubmitSchema.safeParse(body);
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

  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, error: "firestore_not_configured" }, { status: 503 });
  }

  const { categories: activeCategories } = await fetchEventCategories();
  const knownSlug = activeCategories.find((c) => c.slug === data.category && c.isActive);
  if (!knownSlug) {
    return NextResponse.json({ ok: false, error: "unknown_category" }, { status: 400 });
  }

  const since = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  try {
    const recent = await db
      .collection(EVENTS_COLLECTION)
      .where("submittedBy.uid", "==", session.uid)
      .where("createdAt", ">", since)
      .count()
      .get();
    if (recent.data().count >= RATE_LIMIT_PER_DAY) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
  } catch {
    // count() requires a composite index; if missing, skip rate limit rather than block submission.
  }

  const startsAtDate = new Date(data.startsAt);
  const recurrenceRRule =
    data.recurrence && data.recurrence !== "none"
      ? buildRRule(data.recurrence, startsAtDate)
      : undefined;

  // The caller's claim to host this event under a specific mosque must be
  // re-checked server-side — never trust the client. If the verification
  // fails we silently drop the field rather than reject the submission, so
  // unauthorized callers can't probe which slugs exist.
  let verifiedMosqueId: string | undefined;
  if (data.mosqueId) {
    const allowed = await canManageMosque(data.mosqueId);
    if (allowed) verifiedMosqueId = data.mosqueId;
  }

  const eventDoc = stripUndefined({
    title: data.title,
    description: data.description,
    category: data.category,
    status: "under_review",
    startsAt: startsAtDate,
    endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
    timezone: data.timezone,
    recurrence: recurrenceRRule,
    location: {
      mode: data.location.mode,
      venue: data.location.venue,
      address: data.location.address,
      country: data.location.country?.toUpperCase(),
      url: data.location.url,
      platform: data.location.platform,
      dialIn: data.location.dialIn,
    },
    organizer: {
      name: data.organizer.name,
      contact: data.organizer.contact,
    },
    rsvpCount: 0,
    mosqueId: verifiedMosqueId,
    submittedBy: { uid: session.uid, email: data.submitterEmail },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const docRef = await db.collection(EVENTS_COLLECTION).add(eventDoc);
    await createNotification({
      type: "submission",
      title: "New event submission",
      body: data.title,
      link: "/admin/events?status=under_review",
      sourceCollection: EVENTS_COLLECTION,
      sourceId: docRef.id,
    });
    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (err) {
    console.warn("[api/events/submit] write failed:", err);
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      const nested = stripUndefined(v as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
