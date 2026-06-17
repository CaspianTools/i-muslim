import Link from "next/link";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getHadithCollections } from "@/lib/hadith/db";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { HadithSidebar } from "@/components/site/hadith/HadithSidebar";
import { HadithMobileDrawer } from "@/components/site/hadith/HadithMobileDrawer";
import { getFavoriteCountsForCollections } from "@/lib/profile/favoriteStats";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("hadithPage");
  return buildPageMetadata({
    locale,
    path: "/hadith",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function HadithIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang: langParam } = await searchParams;
  const [collections, languageSettings, t, tCollections] = await Promise.all([
    getHadithCollections(),
    getLanguageSettings(),
    getTranslations("hadithPage"),
    getTranslations("hadithCollectionNames"),
  ]);

  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";

  if (collections.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("indexHeading")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("preparing")}
        </p>
      </div>
    );
  }

  const slugs = collections.map((c) => c.slug);
  const favoriteCounts = await getFavoriteCountsForCollections(slugs);

  const localizedName = (slug: string, fallback: string): string =>
    tCollections.has(slug) ? tCollections(slug) : fallback;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <div className="flex items-center gap-2 pb-3 md:hidden">
        <HadithMobileDrawer availableLangs={languageSettings.hadithEnabled} />
      </div>
      <div className="flex gap-6">
        <aside className="hidden md:block sticky top-20 self-start">
          <HadithSidebar variant="desktop" availableLangs={languageSettings.hadithEnabled} />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("indexHeading")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("indexSubtitle")}
            </p>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c) => {
              const favCount = favoriteCounts.get(c.slug) ?? 0;
              return (
                <li key={c.slug}>
                  <Link
                    href={`/hadith/${c.slug}${langQS}`}
                    className="group block rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {localizedName(c.slug, c.name_en)}
                      </span>
                      <span
                        dir="rtl"
                        lang="ar"
                        className="font-arabic text-lg text-foreground"
                      >
                        {c.name_ar}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{t("cardCount", { total: c.total, books: c.books.length })}</span>
                      {favCount > 0 && (
                        <span className="hidden md:inline-flex items-center gap-1">
                          <span aria-hidden>·</span>
                          <Heart className="size-3.5" />
                          <span className="tabular-nums">{favCount}</span>
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
