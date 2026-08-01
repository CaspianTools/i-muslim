import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Bookmark,
  BookOpen,
  Check,
  Gift,
  Globe,
  Languages,
  Palette,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import { jsonLdHtml } from "@/lib/seo/jsonld";
import {
  CHANGELOG_PREVIEW_COUNT,
  QURAN_APP,
  QURAN_APP_LATEST,
  QURAN_APP_RELEASES,
} from "@/lib/apps/quran";
import { AppScreenshotRail } from "@/components/apps/AppScreenshotRail";
import { PlayStoreButton } from "@/components/apps/PlayStoreButton";
import { ReleaseList } from "@/components/apps/ReleaseList";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.quran");
  return buildPageMetadata({
    locale,
    path: "/apps/quran",
    title: t("meta.title"),
    description: t("meta.description"),
  });
}

const H2 = "text-2xl font-semibold tracking-tight text-foreground";
const SECTION = "mt-14 scroll-mt-24";

/** Screenshot file -> caption key. Order here is the display order. */
const SHOTS = [
  ["01-surah-list.webp", "surahList"],
  ["02-title-card.webp", "titleCard"],
  ["03-mushaf.webp", "mushaf"],
  ["04-translations.webp", "translations"],
  ["05-tajweed.webp", "tajweed"],
  ["06-tajweed-legend.webp", "tajweedLegend"],
  ["07-ayah-actions.webp", "ayahActions"],
  ["08-dark.webp", "dark"],
] as const;

const shotPath = (file: string) =>
  `/apps/quran/shots/${QURAN_APP.shotSetVersionCode}/${file}`;

/** Feature card -> icon + how many bullets that section has. */
const FEATURES = [
  { key: "reading", Icon: BookOpen, bullets: 5 },
  { key: "tajweed", Icon: Palette, bullets: 2 },
  { key: "translations", Icon: Languages, bullets: 3 },
  { key: "offline", Icon: WifiOff, bullets: 2 },
  { key: "daily", Icon: Bookmark, bullets: 5 },
  { key: "language", Icon: Globe, bullets: 1 },
  { key: "privacy", Icon: ShieldCheck, bullets: 1 },
  { key: "free", Icon: Gift, bullets: 1 },
] as const;

export default async function QuranAppPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("apps.quran");

  const releases = QURAN_APP_RELEASES.slice(0, CHANGELOG_PREVIEW_COUNT);
  const updated = QURAN_APP_LATEST.date
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${QURAN_APP_LATEST.date}T00:00:00Z`))
    : null;

  const shots = SHOTS.map(([file, caption]) => {
    const text = t(`screenshots.captions.${caption}`);
    return {
      src: shotPath(file),
      caption: text,
      alt: t("screenshots.alt", { caption: text }),
    };
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: t("hero.title"),
    description: t("meta.description"),
    url: `${SITE_URL}/${locale}/apps/quran`,
    applicationCategory: "ReferenceApplication",
    operatingSystem: "Android",
    softwareVersion: QURAN_APP_LATEST.version,
    dateModified: QURAN_APP_LATEST.date,
    releaseNotes: QURAN_APP_LATEST.note,
    // Canonical, without the `hl` the on-page button adds.
    installUrl: QURAN_APP.playUrl,
    downloadUrl: QURAN_APP.playUrl,
    image: `${SITE_URL}/apps/quran/icon-512.png`,
    screenshot: shots.map((s) => `${SITE_URL}${s.src}`),
    // The app's own six UI languages, which are not the site's four.
    inLanguage: ["en", "ar", "tr", "id", "ru", "az"],
    isFamilyFriendly: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    author: {
      "@type": "Organization",
      name: "Caspian Tools",
      url: "https://caspiantools.com",
    },
    publisher: { "@type": "Organization", name: "i-muslim", url: SITE_URL },
  };

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
            locale={locale}
            label={t("cta.play")}
            ariaLabel={t("cta.playAria")}
          />
          <p className="text-xs text-muted-foreground">
            {t("hero.version", { version: QURAN_APP_LATEST.version })}
            {updated ? ` · ${t("hero.updated", { date: updated })}` : ""}
          </p>
        </div>
      </header>

      <section id="screenshots" className={SECTION}>
        <h2 className={H2}>{t("screenshots.heading")}</h2>
        <p className="mb-5 mt-2 text-sm text-muted-foreground">
          {t("screenshots.hint", { version: QURAN_APP_LATEST.version })}
        </p>
        <AppScreenshotRail shots={shots} />
      </section>

      <section id="features" className={SECTION}>
        <h2 className={H2}>{t("features.heading")}</h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ key, Icon, bullets }) => (
            <li
              key={key}
              className="flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-6"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-selected text-selected-foreground">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="text-base font-semibold text-foreground">
                  {t(`features.${key}.title`)}
                </h3>
              </div>
              <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                {Array.from({ length: bullets }, (_, i) => (
                  <li key={i} className="flex gap-2">
                    <Check
                      aria-hidden
                      className="mt-1 size-3.5 shrink-0 text-accent"
                    />
                    <span>{t(`features.${key}.b${i + 1}`)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

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
        <p className="mt-4 text-sm">
          <Link
            href="/apps/quran/changelog"
            className="text-primary underline underline-offset-2 hover:text-foreground"
          >
            {t("changelog.viewAll")}
          </Link>
        </p>
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
            locale={locale}
            label={t("cta.play")}
            ariaLabel={t("cta.playAria")}
          />
          <Link
            href="/privacy#android-app"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
          >
            {t("cta.privacy")}
          </Link>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">
          {t("cta.webReaderLead")}{" "}
          <Link
            href="/quran"
            className="text-primary underline underline-offset-2 hover:text-foreground"
          >
            {t("cta.webReaderLink")}
          </Link>
        </p>
      </section>
    </div>
  );
}
