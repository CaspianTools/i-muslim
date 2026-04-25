import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ProfileDetail } from "@/components/site/matrimonial/ProfileDetail";
import { getSiteSession } from "@/lib/auth/session";
import {
  findInterest,
  getProfile,
  isMatched,
} from "@/lib/matrimonial/store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  return { title: profile?.displayName ?? "Profile" };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSiteSession();
  if (!session) redirect(`/login?callbackUrl=/matrimonial/${id}`);

  const me = await getProfile(session.uid);
  if (!me) redirect("/matrimonial/onboarding");

  const target = await getProfile(id);
  if (!target) notFound();
  if (target.id === me.id) redirect("/matrimonial/settings");

  const t = await getTranslations("matrimonial.profile");

  const myInterest = await findInterest(me.id, target.id);
  const theirInterest = await findInterest(target.id, me.id);
  const matched = await isMatched(me.id, target.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ProfileDetail
        viewerId={me.id}
        target={target}
        myInterest={myInterest}
        theirInterest={theirInterest}
        matched={matched}
        backLabel={t("back")}
      />
    </div>
  );
}
