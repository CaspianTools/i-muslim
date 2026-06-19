"use client";

// Makes the signed-in user's permissions available to client components below
// the admin shell, so create affordances (the QuickCreate palette, the "+"
// trigger, and per-page "New X" buttons) can hide what the user can't do
// without threading a prop through every server page. Provided once in the
// admin layout from `session.permissions`.

import { createContext, useContext } from "react";
import { hasPermission } from "@/lib/permissions/check";
import type { Permission, RolePermissions } from "@/lib/permissions/catalog";
import { CREATE_PERMISSION, type CreatableType } from "@/lib/admin/create-permissions";

const PermissionsCtx = createContext<RolePermissions>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: RolePermissions;
  children: React.ReactNode;
}) {
  return (
    <PermissionsCtx.Provider value={permissions}>
      {children}
    </PermissionsCtx.Provider>
  );
}

export function usePermissions(): RolePermissions {
  return useContext(PermissionsCtx);
}

export function useCan(perm: Permission): boolean {
  return hasPermission(useContext(PermissionsCtx), perm);
}

export function useCanCreate(type: CreatableType): boolean {
  return hasPermission(useContext(PermissionsCtx), CREATE_PERMISSION[type]);
}
