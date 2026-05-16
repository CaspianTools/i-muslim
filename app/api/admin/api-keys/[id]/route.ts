import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAdmin, badRequest, notFound, serverError } from "@/lib/admin/api";
import { requireDb } from "@/lib/firebase/admin";
import { API_KEYS_COLLECTION } from "@/lib/api/auth";
import { PatchApiKeySchema } from "@/lib/api/validators";
import { writeApiAuditLog } from "@/lib/api/audit";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = PatchApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const db = requireDb();
    const ref = db.collection(API_KEYS_COLLECTION).doc(id);
    const before = await ref.get();
    if (!before.exists) return notFound(`API key ${id} not found`);

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    const p = parsed.data;
    if (p.name !== undefined) updates.name = p.name;
    if (p.scopes !== undefined) updates.scopes = p.scopes;
    if (p.permissions !== undefined) updates.permissions = p.permissions;
    if (p.expiresAt !== undefined) {
      updates.expiresAt = p.expiresAt ? Timestamp.fromDate(p.expiresAt) : null;
    }

    await ref.update(updates);

    await writeApiAuditLog({
      actor: { kind: "admin", uid: auth.session.uid, email: auth.session.email },
      action: "api_key.updated",
      resourceType: "apiKey",
      resourceId: id,
      details: {
        changedFields: Object.keys(updates).filter((k) => k !== "updatedAt"),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("Failed to update API key", err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const db = requireDb();
    const ref = db.collection(API_KEYS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return notFound(`API key ${id} not found`);

    await ref.update({
      status: "revoked",
      revokedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeApiAuditLog({
      actor: { kind: "admin", uid: auth.session.uid, email: auth.session.email },
      action: "api_key.revoked",
      resourceType: "apiKey",
      resourceId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("Failed to revoke API key", err);
  }
}
