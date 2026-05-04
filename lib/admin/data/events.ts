import "server-only";
import { getDb } from "@/lib/firebase/admin";
import { MOCK_EVENTS } from "@/lib/admin/mock/events";
import type {
  AdminEvent,
  EventCategory,
  EventLocation,
  EventLocationMode,
  EventStatus,
  EventStartAnchor,
  HijriAnchor,
  PrayerAnchor,
  UpcomingEvent,
} from "@/types/admin";
import { nextOccurrenceAfter } from "@/lib/admin/recurrence";

export type EventsResult = {
  events: AdminEvent[];
  source: "firestore" | "mock";
};

const CATEGORIES: EventCategory[] = [
  "prayer",
  "lecture",
  "iftar",
  "janazah",
  "class",
  "fundraiser",
  "community",
  "other",
];
const STATUSES: EventStatus[] = ["under_review", "draft", "published", "cancelled"];
const LOCATION_MODES: EventLocationMode[] = ["in-person", "online", "hybrid"];
const PRAYER_ANCHORS: PrayerAnchor[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === "object" &&
    v &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function asOptionalIso(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return asIso(v);
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asStartAnchor(raw: unknown): EventStartAnchor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const prayer = typeof r.prayer === "string" ? r.prayer : null;
  if (!prayer || !PRAYER_ANCHORS.includes(prayer as PrayerAnchor)) return undefined;
  const offset = typeof r.offsetMinutes === "number" ? r.offsetMinutes : 0;
  return { prayer: prayer as PrayerAnchor, offsetMinutes: offset };
}

function asHijriAnchor(raw: unknown): HijriAnchor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const monthIndex = typeof r.monthIndex === "number" ? r.monthIndex : null;
  const day = typeof r.day === "number" ? r.day : null;
  if (!monthIndex || !day) return undefined;
  if (monthIndex < 1 || monthIndex > 12 || day < 1 || day > 30) return undefined;
  const hourLocal = typeof r.hourLocal === "number" ? r.hourLocal : 0;
  const minuteLocal = typeof r.minuteLocal === "number" ? r.minuteLocal : 0;
  return { monthIndex, day, hourLocal, minuteLocal };
}

function asLocation(raw: unknown): EventLocation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawMode = typeof r.mode === "string" ? r.mode : "in-person";
  const mode: EventLocationMode = LOCATION_MODES.includes(rawMode as EventLocationMode)
    ? (rawMode as EventLocationMode)
    : "in-person";
  return {
    mode,
    venue: asOptionalString(r.venue),
    address: asOptionalString(r.address),
    lat: asOptionalNumber(r.lat),
    lng: asOptionalNumber(r.lng),
    url: asOptionalString(r.url),
    platform: asOptionalString(r.platform),
    dialIn: asOptionalString(r.dialIn),
  };
}

export function normalizeEvent(id: string, raw: Record<string, unknown>): AdminEvent | null {
  if (!raw) return null;
  const title = asString(raw.title);
  if (!title) return null;

  const description = asOptionalString(raw.description);

  const rawCategory = typeof raw.category === "string" ? raw.category : "other";
  const category: EventCategory = CATEGORIES.includes(rawCategory as EventCategory)
    ? (rawCategory as EventCategory)
    : "other";

  const rawStatus = typeof raw.status === "string" ? raw.status : "draft";
  const status: EventStatus = STATUSES.includes(rawStatus as EventStatus)
    ? (rawStatus as EventStatus)
    : "draft";

  const organizerRaw = (raw.organizer ?? {}) as Record<string, unknown>;

  const submittedByRaw = (raw.submittedBy ?? undefined) as
    | { uid?: unknown; email?: unknown }
    | undefined;
  const submittedBy = submittedByRaw
    ? {
        uid: typeof submittedByRaw.uid === "string" ? submittedByRaw.uid : undefined,
        email: typeof submittedByRaw.email === "string" ? submittedByRaw.email : undefined,
      }
    : undefined;

  return {
    id,
    title,
    description,
    category,
    status,
    startsAt: asIso(raw.startsAt),
    endsAt: asOptionalIso(raw.endsAt),
    timezone: asString(raw.timezone, "UTC"),
    location: asLocation(raw.location),
    organizer: {
      name: asString(organizerRaw.name, "Unknown"),
      contact: asOptionalString(organizerRaw.contact),
    },
    capacity: asOptionalNumber(raw.capacity),
    rsvpCount: typeof raw.rsvpCount === "number" ? raw.rsvpCount : 0,
    recurrence: asOptionalString(raw.recurrence),
    startAnchor: asStartAnchor(raw.startAnchor),
    hijriAnchor: asHijriAnchor(raw.hijriAnchor),
    submittedBy,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt ?? raw.createdAt),
  };
}

export async function fetchEvents(): Promise<EventsResult> {
  const db = getDb();
  if (!db) return { events: MOCK_EVENTS, source: "mock" };

  try {
    const snap = await db.collection("events").orderBy("startsAt", "desc").limit(500).get();
    const events = snap.docs
      .map((d) => normalizeEvent(d.id, d.data() as Record<string, unknown>))
      .filter((e): e is AdminEvent => e !== null);
    return { events, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/events] Firestore read failed, falling back to mock:", err);
    return { events: MOCK_EVENTS, source: "mock" };
  }
}

export async function fetchUpcomingEvents(windowDays = 14, limit = 6): Promise<UpcomingEvent[]> {
  const db = getDb();
  const now = new Date();
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  if (!db) return [];

  try {
    const snap = await db
      .collection("events")
      .where("status", "==", "published")
      .limit(500)
      .get();
    if (snap.empty) return [];
    const events = snap.docs
      .map((d) => normalizeEvent(d.id, d.data() as Record<string, unknown>))
      .filter((e): e is AdminEvent => e !== null);
    return projectUpcoming(events, now, horizon, limit);
  } catch (err) {
    console.warn("[admin/data/events] Upcoming Firestore read failed:", err);
    return [];
  }
}

function projectUpcoming(
  events: AdminEvent[],
  from: Date,
  to: Date,
  limit: number,
): UpcomingEvent[] {
  type Pair = { event: AdminEvent; next: Date };
  const pairs: Pair[] = [];
  for (const event of events) {
    if (event.status !== "published") continue;
    const next = nextOccurrenceAfter(event, from);
    if (!next) continue;
    if (next.getTime() > to.getTime()) continue;
    pairs.push({ event, next });
  }
  pairs.sort((a, b) => a.next.getTime() - b.next.getTime());
  return pairs.slice(0, limit).map(({ event, next }) => ({
    id: event.id,
    title: event.title,
    startsAt: next.toISOString(),
    rsvpCount: event.rsvpCount,
  }));
}

