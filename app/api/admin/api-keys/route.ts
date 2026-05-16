import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { requireAdmin, badRequest, serverError } from "@/lib/admin/api";
import { requireDb } from "@/lib/firebase/admin";
import { generateApiKey, getKeyPrefix, hashApiKey } from "@/lib/api/keys";
import { API_KEYS_COLLECTION } from "@/lib/api/auth";
import { CreateApiKeySchema } from "@/lib/api/validators";
import { writeApiAuditLog } from "@/lib/api/audit";
import type { ApiKeyCreatedDto, ApiKeyDto } from "@/types/api";

export const runtime = "nodejs";

function toDto(id: string, data: FirebaseFirestore.DocumentData): ApiKeyDto {
  return {
    id,
    name: data.name,
    keyPrefix: data.keyPrefix,
    scopes: data.scopes ?? [],
    permissions: data.permissions ?? [],
    status: data.status,
    createdBy: data.createdBy,
    createdByEmail: data.createdByEmail,
    requestCount: data.requestCount ?? 0,
    lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString?.() ?? null,
    expiresAt: data.expiresAt?.toDate?.()?.toISOString?.() ?? null,
    revokedAt: data.revokedAt?.toDate?.()?.toISOString?.() ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
  };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const db = requireDb();
    const snap = await db
      .collection(API_KEYS_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();
    const keys = snap.docs.map((d) => toDto(d.id, d.data()));
    return NextResponse.json({ data: keys });
  } catch (err) {
    return serverError("Failed to list API keys", err);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const parsed = CreateApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, scopes, permissions, expiresAt } = parsed.data;

  try {
    const plainKey = generateApiKey();
    const keyHash = hashApiKey(plainKey);
    const keyPrefix = getKeyPrefix(plainKey);

    const db = requireDb();
    const docRef = await db.collection(API_KEYS_COLLECTION).add({
      name,
      keyHash,
      keyPrefix,
      scopes,
      permissions,
      status: "active",
      createdBy: auth.session.uid,
      createdByEmail: auth.session.email,
      requestCount: 0,
      lastUsedAt: null,
      expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
      revokedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeApiAuditLog({
      actor: { kind: "admin", uid: auth.session.uid, email: auth.session.email },
      action: "api_key.created",
      resourceType: "apiKey",
      resourceId: docRef.id,
      details: { name, scopes, permissions, expiresAt: expiresAt?.toISOString() ?? null },
    });

    const fresh = await docRef.get();
    const dto = toDto(docRef.id, fresh.data() ?? {});
    const created: ApiKeyCreatedDto = { ...dto, key: plainKey };
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    return serverError("Failed to create API key", err);
  }
}
