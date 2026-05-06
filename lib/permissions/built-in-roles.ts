// Specs for the five system-seeded roles. Imported by both the runtime
// (lib/admin/data/roles.ts) and the seed script (scripts/seed-roles.ts) so
// they agree on names, descriptions, and starter permission sets.
//
// Seed semantics (see ensureBuiltInRoles):
// - `keymaster` is re-asserted on every run (permissions always "*", protected).
// - The other four are only created if the doc doesn't exist; on re-runs we
//   leave admin-edited permission sets alone.

import {
  ALL_PERMISSIONS,
  WILDCARD,
  type Permission,
  type RolePermissions,
} from "./catalog";

export const KEYMASTER_ROLE_ID = "keymaster";

export interface BuiltInRoleSpec {
  id: string;
  name: string;
  description: string;
  permissions: RolePermissions;
  protected: boolean;
}

const READ_ALL_CONTENT: Permission[] = [
  "dashboard.read",
  "articles.read",
  "quran.read",
  "hadith.read",
  "duas.read",
  "mosques.read",
  "businesses.read",
  "events.read",
  "comments.read",
  "contact.read",
  "prayerTimes.read",
  "uiLocales.read",
  "notifications.read",
];

// `admin`: full power except `roles.manage`. Permissions derived from the
// catalog so future additions land here automatically the next time the
// seed runs against a fresh environment.
const ADMIN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => p !== "roles.manage",
);

const MODERATOR_PERMISSIONS: Permission[] = [
  ...READ_ALL_CONTENT,
  "users.read",
  "comments.moderate",
  "contact.respond",
];

const TRANSLATOR_PERMISSIONS: Permission[] = [
  ...READ_ALL_CONTENT,
  "articles.translate",
  "quran.translate",
  "hadith.translate",
  "duas.translate",
  "mosques.translate",
  "uiLocales.translate",
];

export const BUILT_IN_ROLES: readonly BuiltInRoleSpec[] = [
  {
    id: KEYMASTER_ROLE_ID,
    name: "Keymaster",
    description:
      "Project owner. Holds every current and future permission. Single-holder; cannot be edited or deleted.",
    permissions: WILDCARD,
    protected: true,
  },
  {
    id: "admin",
    name: "Admin",
    description:
      "Full access to all admin features except managing roles & permissions.",
    permissions: ADMIN_PERMISSIONS,
    protected: false,
  },
  {
    id: "moderator",
    name: "Moderator",
    description:
      "Reviews comments, responds to contact messages, reads but does not edit content.",
    permissions: MODERATOR_PERMISSIONS,
    protected: false,
  },
  {
    id: "translator",
    name: "Translator",
    description:
      "Translates Hadith, Quran, articles, duas, mosques, and UI strings into approved languages. Language scope is set per-user.",
    permissions: TRANSLATOR_PERMISSIONS,
    protected: false,
  },
  {
    id: "member",
    name: "Member",
    description: "Default role for newly invited users. No admin access.",
    permissions: [],
    protected: false,
  },
];

export function isBuiltInRoleId(id: string): boolean {
  return BUILT_IN_ROLES.some((r) => r.id === id);
}
