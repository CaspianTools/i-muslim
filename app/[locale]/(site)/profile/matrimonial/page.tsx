import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InboxTabs } from "@/components/site/matrimonial/InboxTabs";
import { MatrimonialEnableForm } from "@/components/site/profile/MatrimonialEnableForm";
import { MatrimonialDisableButton } from "@/components/site/profile/MatrimonialDisableButton";
import { getSiteSession } from "@/lib/auth/session";
import { getProfileFields } from "@/lib/profile/data";
import {
  getProfile,
  isMatched,
  listInterestsForUser,
  listProfiles,
} from "@/lib/matrimonial/store";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profileMatrimonial");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

export default async function ProfileMatrimonialPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/profile/matrimonial");

  const t = await getTranslations("profileMatrimonial");
  const [profileFields, matrimonialProfile] = await Promise.all([
    getProfileFields(session.uid),
    getProfile(session.uid),
  ]);

  const enabled = Boolean(matrimonialProfile);
  const profileComplete = Boolean(profileFields);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
        </div>
        {enabled ? (
          <div className="flex items-center gap-2">
            <Badge variant="success">
              <CheckCircle2 className="size-3.5" /> {t("statusEnabled")}
            </Badge>
            <MatrimonialDisableButton />
          </div>
        ) : (
          <Badge variant="neutral">{t("statusDisabled")}</Badge>
        )}
      </header>

      {!profileComplete ? (
        <section className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertCircle className="size-5 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-medium text-foreground">{t("missingProfileTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("missingProfileBody")}</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/profile">{t("missingProfileCta")}</Link>
            </Button>
          </div>
        </section>
      ) : !enabled ? (
        <MatrimonialEnableForm
          defaultLookingFor={profileFields?.gender === "male" ? "female" : "male"}
        />
      ) : (
        <ProfileMatrimonialInbox uid={session.uid} />
      )}
    </div>
  );
}

async function ProfileMatrimonialInbox({ uid }: { uid: string }) {
  const [{ incoming, outgoing }, { profiles }] = await Promise.all([
    listInterestsForUser(uid),
    listProfiles(),
  ]);
  const profilesById: Record<string, (typeof profiles)[number]> = {};
  for (const p of profiles) profilesById[p.id] = p;

  const matchedIds: string[] = [];
  for (const a of outgoing.filter((i) => i.status === "accepted")) {
    if (await isMatched(uid, a.toUserId)) matchedIds.push(a.toUserId);
  }

  return (
    <InboxTabs
      viewerId={uid}
      incoming={incoming}
      outgoing={outgoing}
      matchedIds={matchedIds}
      profilesById={profilesById}
    />
  );
}
