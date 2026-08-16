import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { type Locale } from "@/i18n/config";
import { getSurahs } from "@/lib/quran/db";
import { getTafsirWork, workHasLang, type TafsirLang } from "@/lib/tafsir/works";
import { getTafsirCatalogEntry } from "@/lib/tafsir/catalog";
import { blocksPerSurah, countBlocks } from "@/lib/tafsir/blocks";

export const revalidate = 86400;

function langLabelKey(lang: TafsirLang) {
  return lang === "ar" ? "languageArabic" : "languageIndonesian";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ work: string; lang: string }>;
}): Promise<Metadata> {
  const { work: workId, lang } = await params;
  const work = getTafsirWork(workId);
  if (!work || !workHasLang(work, lang)) return {};
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("tafsir");
  const language = t(langLabelKey(lang));
  return buildPageMetadata({
    locale,
    path: `/tafsir/${work.id}/${lang}`,
    title: t("langIndexMetaTitle", { language }),
    description: t("langIndexMetaDescription", {
      language,
      passages: t("passageCount", { count: countBlocks(lang) }),
    }),
  });
}

export default async function TafsirLangIndexPage({
  params,
}: {
  params: Promise<{ work: string; lang: string }>;
}) {
  const { work: workId, lang } = await params;
  const work = getTafsirWork(workId);
  if (!work || !workHasLang(work, lang)) notFound();
  if (getTafsirCatalogEntry(work.id, lang)?.renderOnSite !== true) notFound();

  const [chapters, t, tNames] = await Promise.all([
    getSurahs(),
    getTranslations("tafsir"),
    getTranslations("surahNames"),
  ]);

  // Per-surah counts come from the committed index — zero Firestore reads.
  const counts = blocksPerSurah(lang);
  const other = work.langs.find((l) => l !== lang);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-2">
        <Link
          href={`/tafsir/${work.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("backToWork")}
        </Link>
      </div>

      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("langIndexHeading", { language: t(langLabelKey(lang)) })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("passageCount", { count: countBlocks(lang) })}
          </p>
        </div>
        {other && (
          <Link
            href={`/tafsir/${work.id}/${other}`}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t("switchLanguage", { language: t(langLabelKey(other)) })}
          </Link>
        )}
      </header>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((c) => (
          <li key={c.id}>
            <Link
              href={`/tafsir/${work.id}/${lang}/${c.id}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                {c.id}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{c.name_simple}</span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-lg leading-none text-foreground"
                  >
                    {c.name_arabic}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {tNames(String(c.id))} ·{" "}
                  {t("passageCount", { count: counts[c.id] ?? 0 })}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
