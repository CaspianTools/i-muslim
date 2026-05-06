import "server-only";
import type { UserRecord } from "firebase-admin/auth";
import { getAdminAuth, getDb } from "@/lib/firebase/admin";
import { MOCK_USERS } from "@/lib/admin/mock/users";
import type { AdminUser, AdminRole, AdminUserStatus } from "@/types/admin";

export type UsersResult = {
  users: AdminUser[];
  source: "firestore" | "mock";
};

const STATUSES: AdminUserStatus[] = ["active", "pending", "suspended", "banned"];

function asIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === "object" &&
    v &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function compose(
  authUser: UserRecord,
  overlay: Record<string, unknown> | null,
): AdminUser {
  const email = authUser.email ?? "";

  const overlayRole = overlay?.role;
  const role: AdminRole =
    typeof overlayRole === "string" && overlayRole.length > 0
      ? overlayRole
      : "member";

  const overlayLanguages = Array.isArray(overlay?.languages)
    ? (overlay.languages as unknown[]).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      )
    : undefined;

  const overlayStatus = overlay?.status;
  let status: AdminUserStatus = STATUSES.includes(overlayStatus as AdminUserStatus)
    ? (overlayStatus as AdminUserStatus)
    : "active";
  if (authUser.disabled && status === "active") status = "suspended";

  const overlayName = typeof overlay?.name === "string" ? overlay.name : null;
  const overlayDisplayName =
    typeof overlay?.displayName === "string" ? overlay.displayName : null;
  const name =
    authUser.displayName ??
    overlayDisplayName ??
    overlayName ??
    (email ? (email.split("@")[0] ?? "Unknown") : "Unknown");

  const overlayAvatar =
    typeof overlay?.avatarUrl === "string" ? overlay.avatarUrl : null;

  return {
    id: authUser.uid,
    name,
    email,
    avatarUrl: authUser.photoURL ?? overlayAvatar ?? null,
    role,
    languages: overlayLanguages,
    status,
    verified: Boolean(authUser.emailVerified),
    joinedAt: asIso(authUser.metadata.creationTime ?? overlay?.joinedAt ?? overlay?.createdAt),
    lastActiveAt: asIso(
      authUser.metadata.lastSignInTime ||
        authUser.metadata.creationTime ||
        overlay?.lastActiveAt ||
        overlay?.updatedAt,
    ),
  };
}

export async function countPendingUsers(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  try {
    const snap = await db.collection("users").where("status", "==", "pending").count().get();
    return snap.data().count;
  } catch (err) {
    console.warn("[admin/data/users] countPendingUsers failed:", err);
    return 0;
  }
}

export async function fetchUsers(): Promise<UsersResult> {
  const auth = getAdminAuth();
  if (!auth) return { users: MOCK_USERS, source: "mock" };

  try {
    const list = await auth.listUsers(1000);
    if (list.users.length === 0) return { users: [], source: "firestore" };

    const overlays = new Map<string, Record<string, unknown>>();
    const db = getDb();
    if (db) {
      try {
        const refs = list.users.map((u) => db.collection("users").doc(u.uid));
        const docs = await db.getAll(...refs);
        for (const doc of docs) {
          if (doc.exists) {
            overlays.set(doc.id, doc.data() as Record<string, unknown>);
          }
        }
      } catch (err) {
        console.warn("[admin/data/users] Firestore overlay read failed:", err);
      }
    }

    const users = list.users
      .map((u) => compose(u, overlays.get(u.uid) ?? null))
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    return { users, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/users] Auth read failed, falling back to mock:", err);
    return { users: MOCK_USERS, source: "mock" };
  }
}
