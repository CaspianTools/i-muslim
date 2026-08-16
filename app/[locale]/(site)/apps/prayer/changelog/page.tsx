import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getPrayerReleases } from "@/lib/apps/prayer-releases";
import { ReleaseList } from "@/components/apps/ReleaseList";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.prayer.changelog.page");
  return buildPageMetadata({
    locale,
    path: "/apps/prayer/changelog",
    title: t("title"),
    description: t("description"),
  });
}

/**
 * The full release history.
 *
 * This page exists because there is nowhere else to point at: the app repo is
 * private and has no CHANGELOG.md, and Play only ever shows the current
 * release's notes. So the site is the canonical home for the app's history.
 */
export default async function PrayerAppChangelogPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.prayer.changelog.page");
  const tc = await getTranslations("apps.prayer.changelog");
  const releases = await getPrayerReleases();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="mb-6 text-sm">
        <Link
          href="/apps/prayer"
          className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-3.5 rtl:rotate-180" />
          {t("back")}
        </Link>
      </p>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("lead")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("count", { count: releases.length })}
        </p>
      </header>

      <ReleaseList
        releases={releases}
        locale={locale}
        noNoteLabel={tc("noNote")}
      />
    </div>
  );
}
