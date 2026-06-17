import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSession } from "@/lib/auth/session";
import { fetchMosqueBySlug } from "@/lib/admin/data/mosques";
import { pickLocalized } from "@/lib/utils";
import { MosqueApplyForm, type ClaimTarget } from "@/components/mosque/MosqueApplyForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosques.apply");
  return { title: t("title"), description: t("subtitle"), robots: { index: false, follow: false } };
}

export default async function MosqueApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const [{ slug }, session, locale] = await Promise.all([
    searchParams,
    getSiteSession(),
    getLocale(),
  ]);

  if (!session) {
    const cb = `/mosques/apply${slug ? `?slug=${slug}` : ""}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(cb)}`);
  }

  const t = await getTranslations("mosques.apply");

  let claimTarget: ClaimTarget | undefined;
  if (slug) {
    const { mosque } = await fetchMosqueBySlug(slug);
    if (mosque) {
      claimTarget = {
        slug: mosque.slug,
        name: pickLocalized(mosque.name, locale, "en") ?? mosque.name.en,
        alreadyManaged: (mosque.managers?.length ?? 0) > 0,
      };
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("proofGuideline")}
        </p>
      </header>
      <div className="mt-6">
        <MosqueApplyForm claimTarget={claimTarget} userEmail={session.email ?? ""} />
      </div>
    </div>
  );
}
