import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requirePermission, badRequest, serverError } from "@/lib/admin/api";
import { requireAdminAuth, requireDb } from "@/lib/firebase/admin";
import { getRole, KEYMASTER_ROLE_ID } from "@/lib/admin/data/roles";

export const runtime = "nodejs";

const BulkSchema = z
  .object({
    ids: z.array(z.string().min(1).max(200)).min(1).max(500),
    op: z.enum(["role", "status", "delete"]),
    role: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/).optional(),
    status: z.enum(["active", "pending", "suspended", "banned"]).optional(),
  })
  .strict();

export async function POST(req: Request) {
  // Bulk endpoint accepts multiple op types; gate on the broadest one needed,
  // then re-check below for ops that need a stricter perm.
  const auth = await requirePermission("users.edit");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const parsed = BulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { ids, op, role, status } = parsed.data;
  if (op === "role" && !role) return badRequest("role required for op=role");
  if (op === "status" && !status) return badRequest("status required for op=status");
  if (op === "delete") {
    if (ids.includes(auth.session.uid)) {
      return NextResponse.json(
        { error: "Cannot delete your own account in a bulk operation" },
        { status: 400 },
      );
    }
    const deleteAuth = await requirePermission("users.delete");
    if (!deleteAuth.ok) return deleteAuth.response;
  }
  if (op === "status") {
    const suspendAuth = await requirePermission("users.suspend");
    if (!suspendAuth.ok) return suspendAuth.response;
  }

  if (op === "role" && role) {
    if (role === KEYMASTER_ROLE_ID) {
      return badRequest("Keymaster role cannot be assigned through the API.");
    }
    const roleDoc = await getRole(role);
    if (!roleDoc) return badRequest(`Role "${role}" not found.`);
  }

  try {
    const db = requireDb();
    const fbAuth = requireAdminAuth();

    if (op === "delete") {
      // Delete in chunks of 400 to stay under batch limits.
      for (let i = 0; i < ids.length; i += 400) {
        const slice = ids.slice(i, i + 400);
        const batch = db.batch();
        for (const id of slice) batch.delete(db.collection("users").doc(id));
        await batch.commit();
        await Promise.all(
          slice.map((id) => fbAuth.deleteUser(id).catch(() => undefined)),
        );
      }
    } else {
      const updates: Record<string, unknown> = {
        lastActiveAt: FieldValue.serverTimestamp(),
      };
      if (op === "role") updates.role = role;
      if (op === "status") updates.status = status;

      for (let i = 0; i < ids.length; i += 400) {
        const slice = ids.slice(i, i + 400);
        const batch = db.batch();
        for (const id of slice) {
          batch.set(db.collection("users").doc(id), updates, { merge: true });
        }
        await batch.commit();
      }
    }

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err) {
    return serverError("Bulk operation failed", err);
  }
}
