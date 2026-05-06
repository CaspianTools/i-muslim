import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession, getSiteSession, type AdminSession, type SiteSession } from "@/lib/auth/session";
import {
  hasPermission,
  hasPermissionForLanguage,
} from "@/lib/permissions/check";
import type { Permission } from "@/lib/permissions/catalog";

/**
 * Wraps an admin route handler with session + dashboard.read verification.
 * Kept for routes that haven't migrated to permission-specific gates yet —
 * new code should prefer `requirePermission()` below.
 */
export async function requireAdmin(): Promise<
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/**
 * Route-handler permission gate. Returns 401 if not signed in, 403 if the
 * session is missing the requested permission. Otherwise returns the session.
 *
 *   const auth = await requirePermission("hadith.translate");
 *   if (!auth.ok) return auth.response;
 *   // auth.session is the validated SiteSession
 */
export async function requirePermission(
  perm: Permission,
): Promise<
  | { ok: true; session: SiteSession }
  | { ok: false; response: NextResponse }
> {
  const session = await getSiteSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasPermission(session.permissions, perm)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", missing: perm },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}

/**
 * Same as requirePermission but additionally checks that `lang` is in the
 * session's approved languages list (only meaningful for `*.translate`
 * permissions). A user with no languages set is treated as unrestricted.
 */
export async function requirePermissionForLanguage(
  perm: Permission,
  lang: string,
): Promise<
  | { ok: true; session: SiteSession }
  | { ok: false; response: NextResponse }
> {
  const session = await getSiteSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasPermissionForLanguage(session.permissions, session.languages, perm, lang)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", missing: perm, language: lang },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string, err?: unknown): NextResponse {
  if (err) console.error(message, err);
  return NextResponse.json({ error: message }, { status: 500 });
}
