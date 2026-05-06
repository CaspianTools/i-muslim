import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getAdminAuth, getDb } from "@/lib/firebase/admin";
import {
  WILDCARD,
  isPermission,
  type Permission,
  type RolePermissions,
} from "@/lib/permissions/catalog";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;

export type SiteSession = {
  uid: string;
  email: string;
  name: string | null;
  picture: string | null;
  roleId: string;
  permissions: RolePermissions;
  languages: string[];
};

// Kept as a synonym for now — `getAdminSession()` returns the same shape but
// only when the user can access /admin (`dashboard.read`).
export type AdminSession = SiteSession;

interface UserOverlay {
  roleId: string;
  languages: string[];
}

async function loadUserOverlay(uid: string): Promise<UserOverlay> {
  const db = getDb();
  if (!db) return { roleId: "member", languages: [] };
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return { roleId: "member", languages: [] };
    const data = snap.data() ?? {};
    const roleId =
      typeof data.role === "string" && data.role.length > 0
        ? data.role
        : "member";
    const languages = Array.isArray(data.languages)
      ? (data.languages as unknown[]).filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        )
      : [];
    return { roleId, languages };
  } catch (err) {
    console.warn("[auth/session] user overlay read failed:", err);
    return { roleId: "member", languages: [] };
  }
}

async function loadRolePermissions(roleId: string): Promise<RolePermissions> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection("roles").doc(roleId).get();
    if (!snap.exists) return [];
    const data = snap.data() ?? {};
    if (data.permissions === WILDCARD) return WILDCARD;
    if (!Array.isArray(data.permissions)) return [];
    return (data.permissions as unknown[]).filter(
      (v): v is Permission => typeof v === "string" && isPermission(v),
    );
  } catch (err) {
    console.warn("[auth/session] role read failed:", err);
    return [];
  }
}

export const getSiteSession = cache(async (): Promise<SiteSession | null> => {
  const auth = getAdminAuth();
  if (!auth) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let decoded: { uid: string; email?: string; name?: string; picture?: string };
  try {
    decoded = await auth.verifySessionCookie(token, true);
  } catch {
    return null;
  }
  if (!decoded.email) return null;

  const uid = decoded.uid;
  const email = decoded.email;
  const name = decoded.name ?? null;
  const picture = decoded.picture ?? null;

  const overlay = await loadUserOverlay(uid);
  const permissions = await loadRolePermissions(overlay.roleId);

  return {
    uid,
    email,
    name,
    picture,
    roleId: overlay.roleId,
    permissions,
    languages: overlay.languages,
  };
});

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const session = await getSiteSession();
  if (!session) return null;
  if (session.permissions === WILDCARD) return session;
  if (!session.permissions.includes("dashboard.read")) return null;
  return session;
});

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireSiteSession(): Promise<SiteSession> {
  const session = await getSiteSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
