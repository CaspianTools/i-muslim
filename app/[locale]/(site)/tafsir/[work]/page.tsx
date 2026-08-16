import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { type Locale } from "@/i18n/config";
import { getTafsirWork, type TafsirLang } from "@/lib/tafsir/works";
import { getTafsirCatalogEntry } from "@/lib/tafsir/catalog";
import { countBlocks } from "@/lib/tafsir/blocks";
import { TafsirWorkJsonLd } from "./TafsirWorkJsonLd";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ work: string }>;
}): Promise<Metadata> {
  const { work: workId } = await params;
  const work = getTafsirWork(workId);
  if (!work) return {};
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("tafsir");
  return buildPageMetadata({
    locale,
    path: `/tafsir/${work.id}`,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function TafsirWorkPage({
  params,
}: {
  params: Promise<{ work: string }>;
}) {
  const { work: workId } = await params;
  const work = getTafsirWork(workId);
  if (!work) notFound();

  const locale = await getLocale();
  const t = await getTranslations("tafsir");

  const langs = work.langs
    .map((lang) => ({ lang, entry: getTafsirCatalogEntry(work.id, lang) }))
    .filter((x) => x.entry?.renderOnSite === true);

  if (langs.length === 0) notFound();

  const langLabel = (lang: TafsirLang) =>
    lang === "ar" ? t("languageArabic") : t("languageIndonesian");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <TafsirWorkJsonLd work={work} locale={locale} />

      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("workHeading")}
        </h1>
        <p
          dir="rtl"
          lang="ar"
          className="mt-2 font-arabic text-2xl text-foreground sm:text-3xl"
        >
          {work.nameArabic}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{t("workSubtitle")}</p>
      </header>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {langs.map(({ lang, entry }) => (
          <li key={lang}>
            <Link
              href={`/tafsir/${work.id}/${lang}`}
              className="group flex h-full flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{langLabel(lang)}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {lang === "ar" ? t("badgeOriginal") : t("badgeTranslation")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("passageCount", { count: countBlocks(lang) })}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{entry?.edition}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>{t("sourceNote")}</p>
        {langs.map(({ lang, entry }) =>
          entry?.siteNotice ? (
            <p key={lang} className="mt-1">
              {langLabel(lang)}: {entry.siteNotice}
            </p>
          ) : null,
        )}
      </div>

      <div className="mt-6">
        <Link
          href="/quran"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t("readInQuran")}
        </Link>
      </div>
    </div>
  );
}
