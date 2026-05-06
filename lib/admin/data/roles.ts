import "server-only";
import { FieldValue, type Firestore, type Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase/admin";
import {
  isPermission,
  WILDCARD,
  type Permission,
  type RolePermissions,
} from "@/lib/permissions/catalog";
import {
  BUILT_IN_ROLES,
  KEYMASTER_ROLE_ID,
  isBuiltInRoleId,
} from "@/lib/permissions/built-in-roles";

const ROLES_COLLECTION = "roles";

export interface AdminRoleDoc {
  id: string;
  name: string;
  description: string;
  permissions: RolePermissions;
  builtIn: boolean;
  protected: boolean;
  memberCount?: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

function toIso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    return (v as Timestamp).toDate().toISOString();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  return new Date().toISOString();
}

function parsePermissions(raw: unknown): RolePermissions {
  if (raw === WILDCARD) return WILDCARD;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is Permission => typeof v === "string" && isPermission(v));
}

function fromDoc(id: string, data: Record<string, unknown>): AdminRoleDoc {
  return {
    id,
    name: typeof data.name === "string" ? data.name : id,
    description: typeof data.description === "string" ? data.description : "",
    permissions: parsePermissions(data.permissions),
    builtIn: Boolean(data.builtIn),
    protected: Boolean(data.protected),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function getRole(roleId: string): Promise<AdminRoleDoc | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection(ROLES_COLLECTION).doc(roleId).get();
    if (!snap.exists) return null;
    return fromDoc(snap.id, snap.data() as Record<string, unknown>);
  } catch (err) {
    console.warn("[admin/data/roles] getRole failed:", err);
    return null;
  }
}

export async function listRoles(opts?: {
  withMemberCounts?: boolean;
}): Promise<AdminRoleDoc[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db.collection(ROLES_COLLECTION).get();
    const roles = snap.docs.map((d) => fromDoc(d.id, d.data() as Record<string, unknown>));

    if (opts?.withMemberCounts) {
      const counts = await countMembersPerRole(db, roles.map((r) => r.id));
      for (const role of roles) {
        role.memberCount = counts.get(role.id) ?? 0;
      }
    }

    // Stable order: built-ins (in seed order) first, then custom alphabetical.
    const seedOrder = new Map<string, number>(
      BUILT_IN_ROLES.map((r, i) => [r.id, i]),
    );
    return roles.sort((a, b) => {
      const ai = seedOrder.get(a.id);
      const bi = seedOrder.get(b.id);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    console.warn("[admin/data/roles] listRoles failed:", err);
    return [];
  }
}

async function countMembersPerRole(
  db: Firestore,
  roleIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(roleIds.map((id) => [id, 0]));
  // One aggregation query per role keeps reads cheap (1 read each) vs.
  // scanning the full users collection.
  await Promise.all(
    roleIds.map(async (id) => {
      try {
        const snap = await db
          .collection("users")
          .where("role", "==", id)
          .count()
          .get();
        counts.set(id, snap.data().count);
      } catch (err) {
        console.warn("[admin/data/roles] count for role", id, "failed:", err);
      }
    }),
  );
  return counts;
}

interface CreateRoleInput {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

export async function createRole(input: CreateRoleInput): Promise<AdminRoleDoc> {
  const db = getDb();
  if (!db) throw new Error("Firestore not configured");

  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(input.id)) {
    throw new Error(
      "Role id must be lowercase letters, digits, and hyphens (2–41 chars).",
    );
  }
  if (isBuiltInRoleId(input.id)) {
    throw new Error(`Cannot create role with reserved id "${input.id}".`);
  }

  const ref = db.collection(ROLES_COLLECTION).doc(input.id);
  const existing = await ref.get();
  if (existing.exists) throw new Error(`Role "${input.id}" already exists.`);

  const sanitizedPermissions = input.permissions.filter(isPermission);

  await ref.set({
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    permissions: sanitizedPermissions,
    builtIn: false,
    protected: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const created = await getRole(input.id);
  if (!created) throw new Error("Failed to read back created role.");
  return created;
}

interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: Permission[];
}

export async function updateRole(
  roleId: string,
  input: UpdateRoleInput,
): Promise<AdminRoleDoc> {
  const db = getDb();
  if (!db) throw new Error("Firestore not configured");

  const role = await getRole(roleId);
  if (!role) throw new Error(`Role "${roleId}" not found.`);
  if (role.protected) {
    throw new Error(`Role "${roleId}" is protected and cannot be edited.`);
  }

  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.permissions !== undefined) {
    patch.permissions = input.permissions.filter(isPermission);
  }

  await db.collection(ROLES_COLLECTION).doc(roleId).set(patch, { merge: true });
  const updated = await getRole(roleId);
  if (!updated) throw new Error("Failed to read back updated role.");
  return updated;
}

export async function deleteRole(roleId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Firestore not configured");

  const role = await getRole(roleId);
  if (!role) throw new Error(`Role "${roleId}" not found.`);
  if (role.builtIn) {
    throw new Error(`Built-in role "${roleId}" cannot be deleted.`);
  }

  // Block deletion if any users still hold this role.
  const memberSnap = await db
    .collection("users")
    .where("role", "==", roleId)
    .limit(1)
    .get();
  if (!memberSnap.empty) {
    throw new Error(
      `Cannot delete role "${roleId}" — at least one user still holds it. Reassign them first.`,
    );
  }

  await db.collection(ROLES_COLLECTION).doc(roleId).delete();
}

export async function ensureBuiltInRoles(): Promise<{
  created: string[];
  updated: string[];
}> {
  const db = getDb();
  if (!db) throw new Error("Firestore not configured");

  const created: string[] = [];
  const updated: string[] = [];

  for (const spec of BUILT_IN_ROLES) {
    const ref = db.collection(ROLES_COLLECTION).doc(spec.id);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        name: spec.name,
        description: spec.description,
        permissions: spec.permissions,
        builtIn: true,
        protected: spec.protected,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created.push(spec.id);
      continue;
    }

    // Re-assert keymaster permissions every run. Other built-ins keep whatever
    // an admin has since edited (we only fix metadata flags).
    const data = snap.data() ?? {};
    const patch: Record<string, unknown> = {
      builtIn: true,
      protected: spec.protected,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (typeof data.name !== "string" || !data.name) patch.name = spec.name;
    if (typeof data.description !== "string") patch.description = spec.description;
    if (spec.id === KEYMASTER_ROLE_ID) {
      patch.permissions = WILDCARD;
    } else if (!Array.isArray(data.permissions) && data.permissions !== WILDCARD) {
      patch.permissions = spec.permissions;
    }

    await ref.set(patch, { merge: true });
    updated.push(spec.id);
  }

  return { created, updated };
}

// Used by the seed script and (defensively) by APIs to guarantee at most one
// keymaster. Returns the ids of users demoted (should normally be 0 or 1).
export async function enforceSingleKeymaster(targetUid: string): Promise<string[]> {
  const db = getDb();
  if (!db) throw new Error("Firestore not configured");

  const snap = await db
    .collection("users")
    .where("role", "==", KEYMASTER_ROLE_ID)
    .get();

  const demoted: string[] = [];
  const batch = db.batch();
  for (const doc of snap.docs) {
    if (doc.id === targetUid) continue;
    batch.set(
      doc.ref,
      { role: "admin", updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    demoted.push(doc.id);
  }
  if (demoted.length > 0) await batch.commit();
  return demoted;
}

// Re-export for callers that don't want to depend on built-in-roles directly.
export { KEYMASTER_ROLE_ID, isBuiltInRoleId };
