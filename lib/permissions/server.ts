import "server-only";

// Server-only request-scoped permission helpers. Throws PermissionError on
// missing session/permission so the caller can surface a 401/403. Client
// components must import from `lib/permissions/check.ts` instead — pulling
// this file into a client bundle would drag in `firebase-admin`.

import { getSiteSession, type SiteSession } from "@/lib/auth/session";
import {
  PermissionError,
  hasPermission,
  hasPermissionForLanguage,
} from "./check";
import type { Permission, RolePermissions } from "./catalog";

export async function getSessionPermissions(): Promise<{
  session: SiteSession | null;
  permissions: RolePermissions;
  languages: readonly string[];
}> {
  const session = await getSiteSession();
  return {
    session,
    permissions: session?.permissions ?? [],
    languages: session?.languages ?? [],
  };
}

export async function requirePermission(perm: Permission): Promise<SiteSession> {
  const session = await getSiteSession();
  if (!session) throw new PermissionError(401, "Not signed in");
  if (!hasPermission(session.permissions, perm)) {
    throw new PermissionError(403, `Missing permission: ${perm}`);
  }
  return session;
}

export async function requirePermissionForLanguage(
  perm: Permission,
  lang: string,
): Promise<SiteSession> {
  const session = await getSiteSession();
  if (!session) throw new PermissionError(401, "Not signed in");
  if (!hasPermissionForLanguage(session.permissions, session.languages, perm, lang)) {
    throw new PermissionError(
      403,
      `Missing permission: ${perm} for language "${lang}"`,
    );
  }
  return session;
}

export { PermissionError };
