import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Heart, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSiteSession } from "@/lib/auth/session";
import { getFirebaseAdminStatus } from "@/lib/firebase/admin";
import { getProfile } from "@/lib/matrimonial/store";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matrimonial.landing");
  return { title: t("title") };
}

export default async function MatrimonialLandingPage() {
  const t = await getTranslations("matrimonial.landing");
  const status = getFirebaseAdminStatus();
  const session = await getSiteSession();
  const profile = session ? await getProfile(session.uid) : null;

  if (session && profile) {
    if (profile.status === "active") redirect("/matrimonial/browse");
    redirect("/matrimonial/settings");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Heart className="size-6" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-3 text-base text-muted-foreground">{t("tagline")}</p>
        <div className="mt-6 flex justify-center">
          {session ? (
            <Button asChild size="lg">
              <Link href="/matrimonial/onboarding">{t("ctaContinue")}</Link>
            </Button>
          ) : (
            <Button asChild size="lg" disabled={!status.configured}>
              <Link href="/login?callbackUrl=/matrimonial/onboarding">{t("ctaSignIn")}</Link>
            </Button>
          )}
        </div>
        {!status.configured && (
          <p className="mt-3 text-xs text-warning">{t("notConfigured")}</p>
        )}
      </div>
      <div className="mt-12 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("expectationsTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("expectationsBody")}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
        <Pillar icon={<Sparkles className="size-4 text-primary" />} text="Photos hidden until match" />
        <Pillar icon={<ShieldCheck className="size-4 text-primary" />} text="Admin-reviewed profiles" />
        <Pillar icon={<Heart className="size-4 text-primary" />} text="Marriage intent only" />
      </div>
    </div>
  );
}

function Pillar({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      {icon}
      <span className="text-foreground">{text}</span>
    </div>
  );
}
