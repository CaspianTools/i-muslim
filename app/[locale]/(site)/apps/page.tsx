import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { QURAN_APP } from "@/lib/apps/quran";
import { PRAYER_APP } from "@/lib/apps/prayer";
import { getQuranLatestRelease } from "@/lib/apps/quran-releases";
import { getPrayerLatestRelease } from "@/lib/apps/prayer-releases";
import { PlayStoreButton } from "@/components/apps/PlayStoreButton";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.index");
  return buildPageMetadata({
    locale,
    path: "/apps",
    title: t("meta.title"),
    description: t("meta.description"),
  });
}

const BADGES = ["offline", "noAds", "noTracking", "free"] as const;

/**
 * The app index.
 *
 * Names, taglines and badges are read from each app's own namespace rather than
 * copied into `apps.index` — `hero.title` is the exact per-locale Play store
 * name, and a second copy of it would drift the first time an app is renamed.
 */
export default async function AppsIndexPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.index");

  const [tQuran, tPrayer, quranLatest, prayerLatest] = await Promise.all([
    getTranslations("apps.quran"),
    getTranslations("apps.prayer"),
    getQuranLatestRelease(),
    getPrayerLatestRelease(),
  ]);

  const formatDate = (date?: string) =>
    date
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(new Date(`${date}T00:00:00Z`))
      : null;

  const apps = [
    {
      slug: "quran",
      href: "/apps/quran" as const,
      t: tQuran,
      playUrl: QURAN_APP.playUrl,
      icon: "/apps/quran/icon-512.png",
      latest: quranLatest,
    },
    {
      slug: "prayer",
      href: "/apps/prayer" as const,
      t: tPrayer,
      playUrl: PRAYER_APP.playUrl,
      icon: "/apps/prayer/icon-512.png",
      latest: prayerLatest,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("heading")}
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
          {t("lead")}
        </p>
      </header>

      <ul id="apps-list" className="mt-10 grid gap-6 sm:grid-cols-2">
        {apps.map((app) => {
          const name = app.t("hero.title");
          const updated = formatDate(app.latest.date);
          return (
            <li
              key={app.slug}
              className="flex h-full flex-col rounded-xl border border-border bg-background p-6"
            >
              <div className="flex items-start gap-4">
                <Image
                  src={app.icon}
                  alt={t("iconAlt", { app: name })}
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 shrink-0 rounded-xl"
                />
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">
                    {name}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {app.t("hero.tagline")}
                  </p>
                </div>
              </div>

              <ul className="mt-5 flex flex-wrap gap-2">
                {BADGES.map((key) => (
                  <li
                    key={key}
                    className="rounded-full bg-selected px-3 py-1 text-xs font-medium text-selected-foreground"
                  >
                    {app.t(`badges.${key}`)}
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-xs text-muted-foreground">
                {t("version", { version: app.latest.version })}
                {updated ? ` · ${t("updated", { date: updated })}` : ""}
              </p>

              {/* mt-auto keeps both cards' actions on the same line when the
                  taglines differ in length. */}
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                <Link
                  href={app.href}
                  aria-label={t("openAppAria", { app: name })}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {t("openApp")}
                  <ArrowRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
                </Link>
                <PlayStoreButton
                  playUrl={app.playUrl}
                  locale={locale}
                  label={app.t("cta.play")}
                  ariaLabel={app.t("cta.playAria")}
                  variant="secondary"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
