// Pure permission checks — safe to import from client and server alike.
//
// Server-side helpers that need the cached session (`requirePermission`,
// `requirePermissionForLanguage`, `getSessionPermissions`) live in
// `lib/permissions/server.ts` so client components don't accidentally pull in
// `firebase-admin` via the session module.

import {
  WILDCARD,
  isLanguageScopedPermission,
  type Permission,
  type RolePermissions,
} from "./catalog";

export function hasPermission(
  permissions: RolePermissions,
  perm: Permission,
): boolean {
  if (permissions === WILDCARD) return true;
  return permissions.includes(perm);
}

// Translate-style permissions also require the requested language to be in
// the user's approved-languages list. An empty/missing user list means
// "unrestricted" — the permission alone is sufficient.
export function hasPermissionForLanguage(
  permissions: RolePermissions,
  userLanguages: readonly string[] | undefined,
  perm: Permission,
  lang: string,
): boolean {
  if (!hasPermission(permissions, perm)) return false;
  if (!isLanguageScopedPermission(perm)) return true;
  if (permissions === WILDCARD) return true;
  if (!userLanguages || userLanguages.length === 0) return true;
  return userLanguages.includes(lang);
}

// Filter a list of language codes down to those the session can translate
// for the given permission. Useful in server components that want to render
// a translation editor with view-only state for non-editable languages.
export function editableLanguagesFor(
  permissions: RolePermissions,
  userLanguages: readonly string[] | undefined,
  perm: Permission,
  candidateLangs: readonly string[],
): string[] {
  if (!hasPermission(permissions, perm)) return [];
  if (permissions === WILDCARD) return [...candidateLangs];
  if (!userLanguages || userLanguages.length === 0) return [...candidateLangs];
  return candidateLangs.filter((l) => userLanguages.includes(l));
}

export class PermissionError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "PermissionError";
  }
}
