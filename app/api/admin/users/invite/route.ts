import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requirePermission, badRequest, serverError } from "@/lib/admin/api";
import { requireAdminAuth, requireDb } from "@/lib/firebase/admin";
import { getRole, KEYMASTER_ROLE_ID } from "@/lib/admin/data/roles";

export const runtime = "nodejs";

const InviteSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email().max(320),
    role: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, "Invalid role id"),
    languages: z.array(z.string().min(2).max(10)).max(20).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const auth = await requirePermission("users.invite");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, email, role, languages } = parsed.data;

  if (role === KEYMASTER_ROLE_ID) {
    return badRequest("Keymaster role cannot be assigned through the API.");
  }
  const roleDoc = await getRole(role);
  if (!roleDoc) return badRequest(`Role "${role}" not found.`);

  try {
    const fbAuth = requireAdminAuth();
    const db = requireDb();

    // Look up first; if exists, just upsert the Firestore profile.
    let uid: string;
    try {
      const existing = await fbAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const created = await fbAuth.createUser({
        email,
        displayName: name,
        emailVerified: false,
        disabled: false,
      });
      uid = created.uid;
    }

    const now = FieldValue.serverTimestamp();
    await db.collection("users").doc(uid).set(
      {
        id: uid,
        name,
        email,
        role,
        languages: languages ?? [],
        status: "pending",
        verified: false,
        joinedAt: now,
        lastActiveAt: now,
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      user: {
        id: uid,
        name,
        email,
        role,
        languages: languages ?? [],
        status: "pending",
        verified: false,
        avatarUrl: null,
        joinedAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return serverError("Failed to invite user", err);
  }
}
