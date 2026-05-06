import "server-only";
import type { UserRecord } from "firebase-admin/auth";
import { getAdminAuth, getDb } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/auth/allowlist";
import { MOCK_USERS } from "@/lib/admin/mock/users";
import type { AdminUser, AdminRole, AdminUserStatus } from "@/types/admin";

export type UsersResult = {
  users: AdminUser[];
  source: "firestore" | "mock";
};

const ROLES: AdminRole[] = ["admin", "moderator", "scholar", "member"];
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
  const role: AdminRole = ROLES.includes(overlayRole as AdminRole)
    ? (overlayRole as AdminRole)
    : isAdminEmail(email)
      ? "admin"
      : "member";

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
    const authUsers: UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken);

    if (authUsers.length === 0) return { users: [], source: "firestore" };

    const overlays = new Map<string, Record<string, unknown>>();
    const db = getDb();
    if (db) {
      try {
        for (let i = 0; i < authUsers.length; i += 300) {
          const slice = authUsers.slice(i, i + 300);
          const refs = slice.map((u) => db.collection("users").doc(u.uid));
          const docs = await db.getAll(...refs);
          for (const doc of docs) {
            if (doc.exists) {
              overlays.set(doc.id, doc.data() as Record<string, unknown>);
            }
          }
        }
      } catch (err) {
        console.warn("[admin/data/users] Firestore overlay read failed:", err);
      }
    }

    const users = authUsers
      .map((u) => compose(u, overlays.get(u.uid) ?? null))
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    return { users, source: "firestore" };
  } catch (err) {
    console.warn("[admin/data/users] Auth read failed, falling back to mock:", err);
    return { users: MOCK_USERS, source: "mock" };
  }
}
