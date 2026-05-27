import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getApiCallerSession } from "@/lib/auth/session";
import { requireDb } from "@/lib/firebase/admin";
import { apiError, apiOk, corsPreflight, withCors } from "@/lib/api/responses";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

/**
 * Idempotent user-doc bootstrapper. First mobile sign-in on a new device
 * calls this to ensure `users/{uid}` exists with default role + empty
 * languages list. Existing docs are left untouched.
 */
export async function POST(req: NextRequest) {
  const session = await getApiCallerSession(req);
  if (!session) {
    return withCors(apiError("UNAUTHENTICATED", "Sign-in required", 401));
  }

  const db = requireDb();
  const ref = db.collection("users").doc(session.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set(
      {
        email: session.email,
        name: session.name,
        role: "member",
        languages: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return withCors(
    apiOk({
      uid: session.uid,
      email: session.email,
      roleId: session.roleId,
      languages: session.languages,
      created: !snap.exists,
    }),
  );
}
