import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SubmitEventForm } from "@/components/site/events/SubmitEventForm";
import { getSiteSession } from "@/lib/auth/session";
import { fetchEventCategories } from "@/lib/admin/data/event-categories";
import { fetchMosqueBySlug } from "@/lib/admin/data/mosques";
import { canManageMosque } from "@/lib/mosques/authz";
import { pickLocalized } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("eventsPublic.submit");
  return { title: t("title"), description: t("subtitle") };
}

export default async function SubmitEventPage({
  searchParams,
}: {
  searchParams: Promise<{ mosqueId?: string }>;
}) {
  const t = await getTranslations("eventsPublic.submit");
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/events/submit");

  const [{ categories }, { mosqueId }, locale] = await Promise.all([
    fetchEventCategories(),
    searchParams,
    getLocale(),
  ]);

  // `?mosqueId=<slug>` is a hint from the mosque page CTA — verify the caller
  // is actually a manager (or site admin) before letting the form trust it.
  // If verification fails we silently drop the param so the form behaves as
  // a regular community submission.
  let lockedMosque: { slug: string; name: string } | undefined;
  if (mosqueId) {
    const allowed = await canManageMosque(mosqueId);
    if (allowed) {
      const { mosque } = await fetchMosqueBySlug(mosqueId);
      if (mosque) {
        lockedMosque = {
          slug: mosque.slug,
          name: pickLocalized(mosque.name, locale, "en") ?? mosque.name.en,
        };
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("guideline")}
        </p>
      </header>
      <div className="mt-6">
        <SubmitEventForm
          userEmail={session.email}
          categories={categories}
          lockedMosque={lockedMosque}
        />
      </div>
    </div>
  );
}
