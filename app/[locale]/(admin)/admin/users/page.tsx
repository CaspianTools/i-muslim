import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { UsersPageClient } from "@/components/admin/users/UsersPageClient";
import { fetchUsers } from "@/lib/admin/data/users";
import { listRoles } from "@/lib/admin/data/roles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users");
  return { title: t("pageTitle") };
}

export default async function UsersPage() {
  const [{ users, source }, roles] = await Promise.all([
    fetchUsers(),
    listRoles(),
  ]);
  const t = await getTranslations("users");

  return (
    <div>
      <PageHeader title={t("pageTitle")} />
      <UsersPageClient initialUsers={users} source={source} roles={roles} />
    </div>
  );
}
