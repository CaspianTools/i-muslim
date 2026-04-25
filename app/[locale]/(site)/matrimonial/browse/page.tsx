import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrowseGrid } from "@/components/site/matrimonial/BrowseGrid";
import { getSiteSession } from "@/lib/auth/session";
import { listProfiles, getProfile } from "@/lib/matrimonial/store";
import { mutualFilter } from "@/lib/matrimonial/filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("matrimonial.browse");
  return { title: t("title") };
}

export default async function BrowsePage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/matrimonial/browse");
  const me = await getProfile(session.uid);
  if (!me) redirect("/matrimonial/onboarding");

  const { profiles } = await listProfiles();
  const candidates = profiles.filter((p) => mutualFilter(me, p));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BrowseGrid candidates={candidates} />
    </div>
  );
}
