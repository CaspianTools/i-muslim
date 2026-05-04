"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireDb } from "@/lib/firebase/admin";
import { requireAdminSession } from "@/lib/auth/session";
import { normalizeEvent } from "@/lib/admin/data/events";
import type { AdminEvent } from "@/types/admin";

const categoryEnum = z.enum([
  "prayer",
  "lecture",
  "iftar",
  "janazah",
  "class",
  "fundraiser",
  "community",
  "other",
]);
const statusEnum = z.enum(["under_review", "draft", "published", "cancelled"]);
const locationModeEnum = z.enum(["in-person", "online", "hybrid"]);
const prayerAnchorEnum = z.enum(["fajr", "dhuhr", "asr", "maghrib", "isha"]);

const eventInputSchema = z
  .object({
    title: z.string().min(2),
    description: z.string().optional(),
    category: categoryEnum,
    status: statusEnum,
    startsAt: z.string().min(1),
    endsAt: z.string().optional(),
    timezone: z.string().min(1),
    location: z.object({
      mode: locationModeEnum,
      venue: z.string().optional(),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
      platform: z.string().max(60).optional(),
      dialIn: z.string().max(200).optional(),
    }),
    organizer: z.object({
      name: z.string().min(1),
      contact: z.string().optional(),
    }),
    capacity: z.number().int().nonnegative().optional(),
    recurrence: z.string().optional(),
    startAnchor: z
      .object({
        prayer: prayerAnchorEnum,
        offsetMinutes: z.number().int(),
      })
      .optional(),
    hijriAnchor: z
      .object({
        monthIndex: z.number().int().min(1).max(12),
        day: z.number().int().min(1).max(30),
        hourLocal: z.number().int().min(0).max(23),
        minuteLocal: z.number().int().min(0).max(59),
      })
      .optional(),
  })
  .refine(
    (v) => !v.endsAt || new Date(v.endsAt).getTime() >= new Date(v.startsAt).getTime(),
    { message: "endsAt must be after startsAt", path: ["endsAt"] },
  );

export type EventInput = z.infer<typeof eventInputSchema>;

export type ActionResult<T = AdminEvent> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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

function toFirestorePayload(input: EventInput) {
  return stripUndefined({
    title: input.title,
    description: input.description,
    category: input.category,
    status: input.status,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
    timezone: input.timezone,
    location: input.location,
    organizer: input.organizer,
    capacity: input.capacity,
    recurrence: input.recurrence,
    startAnchor: input.startAnchor,
    hijriAnchor: input.hijriAnchor,
  });
}

async function authorize() {
  await requireAdminSession();
}

export async function createEventAction(input: EventInput): Promise<ActionResult> {
  try {
    await authorize();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let db;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured. Add Firebase env vars to enable persistence." };
  }

  try {
    const payload = {
      ...toFirestorePayload(parsed.data),
      rsvpCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection("events").add(payload);
    const snap = await ref.get();
    const created = normalizeEvent(ref.id, snap.data() as Record<string, unknown>);
    if (!created) return { ok: false, error: "Failed to read back created event" };

    revalidatePath("/admin/events");
    revalidatePath("/admin");
    return { ok: true, data: created };
  } catch (err) {
    console.warn("[admin/actions/events] createEvent failed:", err);
    return { ok: false, error: "Failed to create event" };
  }
}

export async function updateEventAction(id: string, input: EventInput): Promise<ActionResult> {
  try {
    await authorize();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let db;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured. Add Firebase env vars to enable persistence." };
  }

  try {
    const ref = db.collection("events").doc(id);
    await ref.set(
      {
        ...toFirestorePayload(parsed.data),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: "Event not found" };
    const updated = normalizeEvent(ref.id, snap.data() as Record<string, unknown>);
    if (!updated) return { ok: false, error: "Failed to read back event" };

    revalidatePath("/admin/events");
    revalidatePath("/admin");
    return { ok: true, data: updated };
  } catch (err) {
    console.warn("[admin/actions/events] updateEvent failed:", err);
    return { ok: false, error: "Failed to update event" };
  }
}

export async function deleteEventAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await authorize();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!id) return { ok: false, error: "Missing id" };

  let db;
  try {
    db = requireDb();
  } catch {
    return { ok: false, error: "Firestore is not configured. Add Firebase env vars to enable persistence." };
  }

  try {
    await db.collection("events").doc(id).delete();
    revalidatePath("/admin/events");
    revalidatePath("/admin");
    return { ok: true, data: { id } };
  } catch (err) {
    console.warn("[admin/actions/events] deleteEvent failed:", err);
    return { ok: false, error: "Failed to delete event" };
  }
}
