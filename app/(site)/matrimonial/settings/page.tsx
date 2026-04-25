import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsActions } from "@/components/site/matrimonial/SettingsActions";
import { getSiteSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/matrimonial/store";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matrimonial.settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/matrimonial/settings");
  const profile = await getProfile(session.uid);
  if (!profile) redirect("/matrimonial/onboarding");
  const t = await getTranslations("matrimonial.settings");
  const tStatuses = await getTranslations("matrimonial.statuses");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">{profile.displayName}</div>
            <div className="text-xs text-muted-foreground">{profile.userId}</div>
          </div>
          <Badge variant={profile.status === "active" ? "success" : "warning"}>
            {tStatuses(profile.status)}
          </Badge>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/matrimonial/onboarding">{t("edit")}</Link>
          </Button>
          <SettingsActions status={profile.status} />
        </div>
      </div>
    </div>
  );
}
