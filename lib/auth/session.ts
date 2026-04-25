import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getAdminAuth } from "@/lib/firebase/admin";
import { isAdminEmail } from "@/lib/auth/allowlist";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;

export type AdminSession = {
  uid: string;
  email: string;
  name: string | null;
  picture: string | null;
};

export type SiteSession = AdminSession;

export const getSiteSession = cache(async (): Promise<SiteSession | null> => {
  const auth = getAdminAuth();
  if (!auth) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const decoded = await auth.verifySessionCookie(token, true);
    if (!decoded.email) return null;
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: (decoded.name as string | undefined) ?? null,
      picture: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
});

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const session = await getSiteSession();
  if (!session) return null;
  if (!isAdminEmail(session.email)) return null;
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
