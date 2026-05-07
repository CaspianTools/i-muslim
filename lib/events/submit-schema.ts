import { z } from "zod";

export const EVENT_SUBMISSIONS_COLLECTION = "eventSubmissions";

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Slug shape only — admin-managed categories live in Firestore
// (`eventCategories` collection). Slug-existence is enforced at the action
// layer via fetchEventCategories().
const categoryEnum = z
  .string()
  .min(2)
  .regex(/^[a-z0-9-]+$/, "Invalid category");

const locationModeEnum = z.enum(["in-person", "online", "hybrid"]);

const recurrenceEnum = z.enum(["none", "weekly", "monthly"]);

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const eventSubmitSchema = z
  .object({
    title: z.string().trim().min(2),
    description: z.string().trim().optional(),
    category: categoryEnum,
    startsAt: z.string().min(1),
    endsAt: z.string().optional().or(z.literal("").transform(() => undefined)),
    timezone: z.string().min(1),
    recurrence: recurrenceEnum.optional(),
    location: z.object({
      mode: locationModeEnum,
      venue: optionalTrimmed,
      address: optionalTrimmed,
      country: z
        .string()
        .regex(/^[A-Za-z]{2}$/)
        .optional()
        .or(z.literal("").transform(() => undefined)),
      url: optionalUrl,
      platform: z.string().trim().max(60).optional().or(z.literal("").transform(() => undefined)),
      dialIn: z.string().trim().max(200).optional().or(z.literal("").transform(() => undefined)),
    }),
    organizer: z.object({
      name: z.string().trim().min(1),
      contact: optionalTrimmed,
    }),
    submitterEmail: z.string().email(),
    /**
     * Slug of a mosque this event is hosted by. The submit endpoint verifies
     * the caller is in `mosques/{slug}.managers[]` (or has `mosques.write`)
     * before persisting; an unauthorized slug is dropped, not surfaced as an
     * error, so we don't leak whether a slug exists.
     */
    mosqueId: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    website_url_secondary: z.string().optional(),
  })
  .refine(
    (v) => !v.endsAt || new Date(v.endsAt).getTime() >= new Date(v.startsAt).getTime(),
    { message: "endsAt must be after startsAt", path: ["endsAt"] },
  )
  .refine(
    (v) =>
      !v.endsAt ||
      new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() <= MAX_DURATION_MS,
    { message: "Event duration cannot exceed 30 days", path: ["endsAt"] },
  )
  .refine(
    (v) => v.location.mode === "online" || Boolean(v.location.venue || v.location.address),
    { message: "Venue or address is required for in-person events", path: ["location", "venue"] },
  )
  .refine(
    (v) => v.location.mode === "in-person" || Boolean(v.location.url),
    { message: "Meeting URL is required for online events", path: ["location", "url"] },
  );

export type EventSubmitInput = z.infer<typeof eventSubmitSchema>;
