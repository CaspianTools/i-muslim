import type { NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { writeApiAuditLog } from "@/lib/api/audit";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";
import { getApiCallerSession } from "@/lib/auth/session";
import { requireDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const PutSchema = z.object({
  resource: z.enum(["quran", "hadith"]),
  ref: z.string().min(1).max(64),
  lastAt: z.string().datetime().optional(),
});

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * PUT /api/v1/me/reading-progress
 * Body: { resource: "quran" | "hadith", ref: string, lastAt?: ISO }
 *
 * Records the user's *last viewed* position per resource. This is auto-
 * tracked state — separate from explicit "Mark as Read" toggles, which use
 * the `users/{uid}/reads/{readId}` collection via [lib/reads/data.ts].
 *
 * Stored as a single denormalised doc at `users/{uid}/state/readingProgress`
 * with one key per resource, so a single read fetches everything for the
 * profile page. Server timestamp wins over a client-supplied `lastAt` for
 * cross-device correctness.
 */
export async function PUT(req: NextRequest) {
  const session = await getApiCallerSession(req);
  if (!session) {
    return withCors(apiError("UNAUTHENTICATED", "Sign-in required", 401));
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return withCors(apiError("INVALID_JSON", "Request body must be JSON", 400));
  }

  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(
      apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid input",
        400,
      ),
    );
  }
  const v = parsed.data;

  const db = requireDb();
  const ref = db
    .collection("users")
    .doc(session.uid)
    .collection("state")
    .doc("readingProgress");

  await ref.set(
    {
      [v.resource]: {
        ref: v.ref,
        lastAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  void writeApiAuditLog({
    actor: { kind: "admin", uid: session.uid, email: session.email },
    action: "reading-progress.update",
    resourceType: v.resource,
    resourceId: v.ref,
  });

  return withCors(apiOk({ resource: v.resource, ref: v.ref }));
}

/* --------------------------------------------------------------------- */
/* GET /api/v1/me/reading-progress — fetch the current denormalised doc.  */
/* --------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  const session = await getApiCallerSession(req);
  if (!session) {
    return withCors(apiError("UNAUTHENTICATED", "Sign-in required", 401));
  }

  const db = requireDb();
  const snap = await db
    .collection("users")
    .doc(session.uid)
    .collection("state")
    .doc("readingProgress")
    .get();

  if (!snap.exists) {
    return withCors(apiOk({ quran: null, hadith: null }));
  }
  const data = snap.data() ?? {};
  return withCors(
    apiOk({
      quran: normalizeProgress(data.quran),
      hadith: normalizeProgress(data.hadith),
    }),
  );
}

function normalizeProgress(raw: unknown): { ref: string; lastAt: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.ref !== "string") return null;
  let lastAt: string;
  if (r.lastAt instanceof Timestamp) lastAt = r.lastAt.toDate().toISOString();
  else if (typeof r.lastAt === "string") lastAt = r.lastAt;
  else lastAt = new Date().toISOString();
  return { ref: r.ref, lastAt };
}
