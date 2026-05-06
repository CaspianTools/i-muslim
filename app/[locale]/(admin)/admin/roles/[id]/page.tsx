import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRole } from "@/lib/admin/data/roles";
import { getSiteSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/check";
import { RoleEditor } from "@/components/admin/roles/RoleEditor";

export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  const role = await getRole(id);
  return { title: role ? `${role.name} · Roles` : "Role not found" };
}

export default async function RoleEditorPage({ params }: PageParams) {
  const { id } = await params;
  const [role, session] = await Promise.all([getRole(id), getSiteSession()]);
  if (!role) notFound();

  const canManage = session ? hasPermission(session.permissions, "roles.manage") : false;
  return <RoleEditor role={role} canManage={canManage} />;
}
