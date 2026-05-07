import { redirect } from "next/navigation";

interface PageParams {
  params: Promise<{ locale: string }>;
}

export default async function LegacyRoleEditorPage({ params }: PageParams) {
  // /admin/roles is now the matrix page; per-role editing happens inline by
  // selecting a role tab. Bookmarks pointing at /admin/roles/<id> land here.
  const { locale } = await params;
  redirect(`/${locale}/admin/roles`);
}
