import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requirePermission, badRequest, serverError } from "@/lib/admin/api";
import { requireAdminAuth, requireDb } from "@/lib/firebase/admin";
import { getRole, KEYMASTER_ROLE_ID } from "@/lib/admin/data/roles";

export const runtime = "nodejs";

const roleIdSchema = z.string().regex(
  /^[a-z0-9][a-z0-9-]{1,40}$/,
  "Invalid role id",
);

const PatchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    role: roleIdSchema.optional(),
    languages: z.array(z.string().min(2).max(10)).max(20).optional(),
    status: z.enum(["active", "pending", "suspended", "banned"]).optional(),
  })
  .strict();

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ uid: string }> },
) {
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return auth.response;

  const { uid } = await ctx.params;
  if (!uid || uid.length > 200) return badRequest("Invalid uid");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.role === KEYMASTER_ROLE_ID) {
    return badRequest("Keymaster role cannot be assigned through the API.");
  }
  if (parsed.data.role) {
    const role = await getRole(parsed.data.role);
    if (!role) return badRequest(`Role "${parsed.data.role}" not found.`);
  }

  try {
    const db = requireDb();
    const updates: Record<string, unknown> = {
      ...parsed.data,
      lastActiveAt: FieldValue.serverTimestamp(),
    };
    await db.collection("users").doc(uid).set(updates, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("Failed to update user", err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ uid: string }> },
) {
  const auth = await requirePermission("users.delete");
  if (!auth.ok) return auth.response;

  const { uid } = await ctx.params;
  if (!uid || uid.length > 200) return badRequest("Invalid uid");

  if (uid === auth.session.uid) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 },
    );
  }

  try {
    const fbAuth = requireAdminAuth();
    const db = requireDb();
    await Promise.all([
      fbAuth.deleteUser(uid).catch(() => undefined),
      db.collection("users").doc(uid).delete(),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("Failed to delete user", err);
  }
}
