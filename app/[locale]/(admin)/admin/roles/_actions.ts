"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, PermissionError } from "@/lib/permissions/server";
import {
  createRole,
  deleteRole,
  updateRole,
  type AdminRoleDoc,
} from "@/lib/admin/data/roles";
import { ALL_PERMISSIONS, isPermission, type Permission } from "@/lib/permissions/catalog";

const idSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,40}$/,
    "Role id must be lowercase letters, digits, and hyphens (2–41 chars).",
  );

const nameSchema = z.string().trim().min(1, "Name is required.").max(80);
const descriptionSchema = z.string().trim().max(500).optional();

const permissionListSchema = z
  .array(z.string())
  .transform((arr) => arr.filter((v): v is Permission => isPermission(v)));

type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: "Unexpected error" };
}

export async function createRoleAction(input: {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
}): Promise<ActionResult<AdminRoleDoc>> {
  try {
    await requirePermission("roles.manage");

    const id = idSchema.parse(input.id);
    const name = nameSchema.parse(input.name);
    const description = descriptionSchema.parse(input.description) ?? "";
    const permissions = permissionListSchema.parse(input.permissions ?? []);

    const role = await createRole({ id, name, description, permissions });
    revalidatePath("/admin/roles");
    return { ok: true, data: role };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join(", ") };
    }
    return fail(err);
  }
}

export async function updateRoleAction(
  roleId: string,
  input: {
    name?: string;
    description?: string;
    permissions?: string[];
  },
): Promise<ActionResult<AdminRoleDoc>> {
  try {
    await requirePermission("roles.manage");

    const patch: { name?: string; description?: string; permissions?: Permission[] } = {};
    if (input.name !== undefined) patch.name = nameSchema.parse(input.name);
    if (input.description !== undefined) {
      patch.description = descriptionSchema.parse(input.description) ?? "";
    }
    if (input.permissions !== undefined) {
      patch.permissions = permissionListSchema.parse(input.permissions);
    }

    const role = await updateRole(roleId, patch);
    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleId}`);
    return { ok: true, data: role };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join(", ") };
    }
    return fail(err);
  }
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  try {
    await requirePermission("roles.manage");
    await deleteRole(roleId);
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// Helper for the editor: returns the canonical permission list. Useful for
// "select all" buttons in the UI.
export async function listAllPermissionsAction(): Promise<Permission[]> {
  return [...ALL_PERMISSIONS];
}
