import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { ContentFlagsClient } from "@/components/admin/flags/ContentFlagsClient";
import { fetchContentFlags } from "@/lib/admin/data/content-flags";
import { getSiteSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/check";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("flagsAdmin");
  return { title: t("pageTitle") };
}

export default async function AdminContentFlagsPage() {
  // Gate the page itself so a direct URL (or a stale notification link) can't
  // load the queue for a role lacking `flags.read`. No admin error boundary
  // exists, so redirect to the dashboard.
  const session = await getSiteSession();
  const locale = await getLocale();
  if (!session || !hasPermission(session.permissions, "flags.read")) {
    redirect(`/${locale}/admin`);
  }

  const t = await getTranslations("flagsAdmin");
  const { flags, source } = await fetchContentFlags();
  return (
    <div>
      <PageHeader title={t("pageTitle")} subtitle={t("pageSubtitle")} />
      <ContentFlagsClient initialFlags={flags} canPersist={source === "firestore"} />
    </div>
  );
}
