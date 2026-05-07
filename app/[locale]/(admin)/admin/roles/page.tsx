import type { Metadata } from "next";
import { listRoles } from "@/lib/admin/data/roles";
import { getSiteSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/check";
import { RolesMatrix } from "@/components/admin/roles/RolesMatrix";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roles & permissions",
};

export default async function RolesPage() {
  const [roles, session] = await Promise.all([
    listRoles({ withMemberCounts: true }),
    getSiteSession(),
  ]);
  const canManage = session ? hasPermission(session.permissions, "roles.manage") : false;
  return <RolesMatrix initialRoles={roles} canManage={canManage} />;
}
