import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { InboxTabs } from "@/components/site/matrimonial/InboxTabs";
import { getSiteSession } from "@/lib/auth/session";
import {
  getProfile,
  isMatched,
  listInterestsForUser,
  listProfiles,
} from "@/lib/matrimonial/store";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matrimonial.inbox");
  return { title: t("title") };
}

export default async function InboxPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/matrimonial/inbox");
  const me = await getProfile(session.uid);
  if (!me) redirect("/matrimonial/onboarding");

  const { incoming, outgoing } = await listInterestsForUser(me.id);
  const { profiles } = await listProfiles();
  const profilesById: Record<string, (typeof profiles)[number]> = {};
  for (const p of profiles) profilesById[p.id] = p;

  const matchedIds: string[] = [];
  for (const a of outgoing.filter((i) => i.status === "accepted")) {
    if (await isMatched(me.id, a.toUserId)) matchedIds.push(a.toUserId);
  }

  const t = await getTranslations("matrimonial.inbox");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={t("title")} />
      <InboxTabs
        viewerId={me.id}
        incoming={incoming}
        outgoing={outgoing}
        matchedIds={matchedIds}
        profilesById={profilesById}
      />
    </div>
  );
}
