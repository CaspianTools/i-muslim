// Permission catalog — single source of truth for every capability gated by
// the RBAC system. Edit here to add or remove a permission; the role editor,
// session resolver, and route gates all consume this file.
//
// Design: permissions are resource + action strings ("hadith.translate").
// Per-language scoping for translation actions is *not* encoded here — it
// lives on the user document as `languages: string[]` and is checked
// alongside the permission via `hasPermissionForLanguage`.

export const PERMISSION_RESOURCES = {
  dashboard: {
    label: "Dashboard",
    actions: ["read"],
  },
  users: {
    label: "Users",
    actions: ["read", "invite", "edit", "suspend", "delete"],
  },
  roles: {
    label: "Roles & permissions",
    actions: ["read", "manage"],
  },
  articles: {
    label: "Articles",
    actions: ["read", "write", "translate", "publish"],
  },
  quran: {
    label: "Quran",
    actions: ["read", "translate", "publish"],
  },
  hadith: {
    label: "Hadith",
    actions: ["read", "translate", "publish"],
  },
  duas: {
    label: "Duas",
    actions: ["read", "write", "translate", "publish"],
  },
  mosques: {
    label: "Mosques",
    actions: ["read", "write", "translate", "publish"],
  },
  businesses: {
    label: "Businesses",
    actions: ["read", "write", "publish"],
  },
  events: {
    label: "Events",
    actions: ["read", "write", "publish"],
  },
  comments: {
    label: "Comments",
    actions: ["read", "moderate"],
  },
  contact: {
    label: "Contact messages",
    actions: ["read", "respond"],
  },
  matrimonial: {
    label: "Matrimonial",
    actions: ["read", "write", "publish"],
  },
  prayerTimes: {
    label: "Prayer times",
    actions: ["read", "write"],
  },
  settings: {
    label: "Site settings",
    actions: ["read", "write"],
  },
  integrations: {
    label: "Integrations",
    actions: ["read", "write"],
  },
  notifications: {
    label: "Notifications",
    actions: ["read"],
  },
  uiLocales: {
    label: "UI strings",
    actions: ["read", "translate"],
  },
} as const;

export type PermissionResource = keyof typeof PERMISSION_RESOURCES;

type ActionFor<R extends PermissionResource> =
  (typeof PERMISSION_RESOURCES)[R]["actions"][number];

export type Permission = {
  [R in PermissionResource]: `${R & string}.${ActionFor<R>}`;
}[PermissionResource];

export const WILDCARD = "*" as const;
export type Wildcard = typeof WILDCARD;

// Stored on a role doc. Keymaster uses "*"; everyone else carries an explicit list.
export type RolePermissions = readonly Permission[] | Wildcard;

export const ALL_PERMISSIONS: readonly Permission[] = Object.entries(
  PERMISSION_RESOURCES,
).flatMap(([resource, def]) =>
  def.actions.map((action) => `${resource}.${action}` as Permission),
);

const ALL_PERMISSIONS_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return ALL_PERMISSIONS_SET.has(value);
}

export function permissionResource(perm: Permission): PermissionResource {
  return perm.split(".")[0] as PermissionResource;
}

export function permissionAction(perm: Permission): string {
  return perm.split(".")[1] ?? "";
}

// Permissions that are language-scoped on a per-user basis. Every `*.translate`
// permission falls into this set — checking one of these against a user
// requires their `languages` array to include the requested language code
// (or be empty/undefined, which means "unrestricted").
export function isLanguageScopedPermission(perm: Permission): boolean {
  return permissionAction(perm) === "translate";
}

// Pretty-printed name for a permission action, used by the role editor.
export function actionLabel(action: string): string {
  switch (action) {
    case "read":
      return "View";
    case "write":
      return "Create & edit";
    case "translate":
      return "Translate";
    case "publish":
      return "Publish";
    case "invite":
      return "Invite";
    case "edit":
      return "Edit";
    case "suspend":
      return "Suspend";
    case "delete":
      return "Delete";
    case "manage":
      return "Manage";
    case "moderate":
      return "Moderate";
    case "respond":
      return "Respond";
    default:
      return action.charAt(0).toUpperCase() + action.slice(1);
  }
}
