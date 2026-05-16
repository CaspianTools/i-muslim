import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";

export const API_AUDIT_COLLECTION = "apiAuditLogs";

export type ApiActorAdmin = { kind: "admin"; uid: string; email: string };
export type ApiActorKey = { kind: "apiKey"; keyId: string; keyName: string };
export type ApiActor = ApiActorAdmin | ApiActorKey;

export interface ApiAuditEntry {
  actor: ApiActor;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  details?: Record<string, unknown>;
}

export async function writeApiAuditLog(entry: ApiAuditEntry): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection(API_AUDIT_COLLECTION).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[api-audit] failed to write entry", err);
  }
}
