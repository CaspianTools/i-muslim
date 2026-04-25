import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { OnboardingForm } from "@/components/site/matrimonial/OnboardingForm";
import { getSiteSession } from "@/lib/auth/session";
import { getProfile } from "@/lib/matrimonial/store";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matrimonial.onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/matrimonial/onboarding");
  const profile = await getProfile(session.uid);
  const t = await getTranslations("matrimonial.onboarding");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <OnboardingForm initial={profile} />
    </div>
  );
}
