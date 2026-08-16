import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Bell,
  BellOff,
  Clock,
  Globe,
  LayoutGrid,
  MapPin,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { jsonLdHtml } from "@/lib/seo/jsonld";
import { CHANGELOG_PREVIEW_COUNT } from "@/lib/apps/types";
import { PRAYER_APP } from "@/lib/apps/prayer";
import { getPrayerReleases } from "@/lib/apps/prayer-releases";
import { mobileAppJsonLd } from "@/lib/apps/jsonld";
import { AppFeatureGrid } from "@/components/apps/AppFeatureGrid";
import { AppScreenshotRail } from "@/components/apps/AppScreenshotRail";
import { PlayStoreButton } from "@/components/apps/PlayStoreButton";
import { ReleaseList } from "@/components/apps/ReleaseList";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.prayer");
  return buildPageMetadata({
    locale,
    path: "/apps/prayer",
    title: t("meta.title"),
    description: t("meta.description"),
  });
}

const H2 = "text-2xl font-semibold tracking-tight text-foreground";
const SECTION = "mt-14 scroll-mt-24";

/** Screenshot file -> caption key. Order here is the display order. */
const SHOTS = [
  ["01-today.webp", "today"],
  ["02-widget.webp", "widget"],
  ["03-adhan.webp", "adhan"],
  ["04-silence.webp", "silence"],
  ["05-methods.webp", "methods"],
  ["06-location.webp", "location"],
  ["07-settings.webp", "settings"],
  ["08-permissions.webp", "permissions"],
] as const;

const shotPath = (file: string) =>
  `/apps/prayer/shots/${PRAYER_APP.shotSetVersionCode}/${file}`;

/** Feature card -> icon + how many bullets that section has. */
const FEATURES = [
  { key: "times", Icon: Clock, bullets: 4 },
  { key: "adhan", Icon: Bell, bullets: 3 },
  { key: "silence", Icon: BellOff, bullets: 3 },
  { key: "widgets", Icon: LayoutGrid, bullets: 3 },
  { key: "location", Icon: MapPin, bullets: 3 },
  { key: "offline", Icon: WifiOff, bullets: 2 },
  { key: "everyone", Icon: Globe, bullets: 3 },
  { key: "privacy", Icon: ShieldCheck, bullets: 2 },
] as const;

export default async function PrayerAppPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.prayer");

  const allReleases = await getPrayerReleases();
  const latest = allReleases[0];
  const releases = allReleases.slice(0, CHANGELOG_PREVIEW_COUNT);
  const updated = latest.date
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${latest.date}T00:00:00Z`))
    : null;

  const shots = SHOTS.map(([file, caption]) => {
    const text = t(`screenshots.captions.${caption}`);
    return {
      src: shotPath(file),
      caption: text,
      alt: t("screenshots.alt", { caption: text }),
    };
  });

  const structuredData = mobileAppJsonLd({
    name: t("hero.title"),
    description: t("meta.description"),
    locale,
    path: "/apps/prayer",
    // A prayer companion is a lifestyle app, not a reference work.
    applicationCategory: "LifestyleApplication",
    latest,
    playUrl: PRAYER_APP.playUrl,
    iconPath: "/apps/prayer/icon-512.png",
    screenshots: shots.map((s) => s.src),
    // The app's own six UI languages, which are not the site's four.
    inLanguage: ["en", "ar", "tr", "id", "ru", "az"],
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(structuredData) }}
      />

      <header className="border-b border-border pb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("hero.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("hero.title")}
        </h1>
        <p className="mt-3 text-lg text-foreground/90">{t("hero.tagline")}</p>
        <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
          {t("hero.lead")}
        </p>

        <ul className="mt-6 flex flex-wrap gap-2">
          {(["offline", "noAds", "noTracking", "free"] as const).map((key) => (
            <li
              key={key}
              className="rounded-full bg-selected px-3 py-1 text-xs font-medium text-selected-foreground"
            >
              {t(`badges.${key}`)}
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
          <PlayStoreButton
            playUrl={PRAYER_APP.playUrl}
            locale={locale}
            label={t("cta.play")}
            ariaLabel={t("cta.playAria")}
          />
          <p className="text-xs text-muted-foreground">
            {t("hero.version", { version: latest.version })}
            {updated ? ` · ${t("hero.updated", { date: updated })}` : ""}
          </p>
        </div>
      </header>

      <section id="screenshots" className={SECTION}>
        <h2 className={H2}>{t("screenshots.heading")}</h2>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">
          {t("screenshots.hint")}
        </p>
        <AppScreenshotRail shots={shots} />
      </section>

      <section id="features" className={SECTION}>
        <h2 className={H2}>{t("features.heading")}</h2>
        <AppFeatureGrid
          features={FEATURES.map(({ key, Icon, bullets }) => ({
            key,
            Icon,
            title: t(`features.${key}.title`),
            bullets: Array.from({ length: bullets }, (_, i) =>
              t(`features.${key}.b${i + 1}`),
            ),
          }))}
        />

        <p className="mt-6 leading-relaxed text-muted-foreground">
          {t.rich("attribution", {
            imuslim: (chunks: ReactNode) => (
              <Link
                href="/about"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {chunks}
              </Link>
            ),
            caspian: (chunks: ReactNode) => (
              <a
                href="https://caspiantools.com/en"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>

      <section id="whats-new" className={SECTION}>
        <h2 className={H2}>{t("changelog.heading")}</h2>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">
          {t("changelog.hint", { count: releases.length })}
        </p>
        <ReleaseList
          releases={releases}
          locale={locale}
          noNoteLabel={t("changelog.noNote")}
        />
        {/* Hidden while the preview already shows everything — otherwise the
            link leads to an identical list. */}
        {allReleases.length > releases.length && (
          <p className="mt-4 text-sm">
            <Link
              href="/apps/prayer/changelog"
              className="text-primary underline underline-offset-2 hover:text-foreground"
            >
              {t("changelog.viewAll")}
            </Link>
          </p>
        )}
      </section>

      <section
        id="get"
        className="mt-14 scroll-mt-24 rounded-xl border border-border bg-muted/40 p-6 sm:p-8"
      >
        <h2 className={H2}>{t("hero.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("hero.tagline")}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PlayStoreButton
            playUrl={PRAYER_APP.playUrl}
            locale={locale}
            label={t("cta.play")}
            ariaLabel={t("cta.playAria")}
          />
          {/* The app has no sign-in, so there is deliberately no
              /delete-account link here — that page is for the apps with
              accounts and does not cover this one. */}
          <Link
            href="/privacy#prayer-app"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
          >
            {t("cta.privacy")}
          </Link>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          {t("cta.webLead")}{" "}
          <Link
            href="/prayer-times"
            className="text-primary underline underline-offset-2 hover:text-foreground"
          >
            {t("cta.webLink")}
          </Link>
        </p>
      </section>
    </div>
  );
}
