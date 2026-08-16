import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { type Locale } from "@/i18n/config";
import { getSurah } from "@/lib/quran/db";
import { getTafsirWork, workHasLang, type TafsirLang } from "@/lib/tafsir/works";
import { getTafsirCatalogEntry } from "@/lib/tafsir/catalog";
import { formatCoverage, listBlockRefs } from "@/lib/tafsir/blocks";
import { getSurahBlockSummaries } from "@/lib/tafsir/db";

export const revalidate = 86400;

function langLabelKey(lang: TafsirLang) {
  return lang === "ar" ? "languageArabic" : "languageIndonesian";
}

function parseSurah(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 114 ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ work: string; lang: string; surah: string }>;
}): Promise<Metadata> {
  const { work: workId, lang, surah: surahRaw } = await params;
  const work = getTafsirWork(workId);
  const surah = parseSurah(surahRaw);
  if (!work || !workHasLang(work, lang) || surah == null) return {};
  const [chapter, t] = await Promise.all([getSurah(surah), getTranslations("tafsir")]);
  if (!chapter) return {};
  const locale = (await getLocale()) as Locale;
  return buildPageMetadata({
    locale,
    path: `/tafsir/${work.id}/${lang}/${surah}`,
    title: t("surahMetaTitle", { name: chapter.name_simple, id: surah }),
    description: t("surahMetaDescription", {
      name: chapter.name_simple,
      language: t(langLabelKey(lang)),
      passages: t("passageCount", { count: listBlockRefs(lang, surah).length }),
    }),
  });
}

export default async function TafsirSurahIndexPage({
  params,
}: {
  params: Promise<{ work: string; lang: string; surah: string }>;
}) {
  const { work: workId, lang, surah: surahRaw } = await params;
  const work = getTafsirWork(workId);
  const surah = parseSurah(surahRaw);
  if (!work || !workHasLang(work, lang) || surah == null) notFound();
  if (getTafsirCatalogEntry(work.id, lang)?.renderOnSite !== true) notFound();

  const [chapter, summaries, t, tNames] = await Promise.all([
    getSurah(surah),
    // ONE document read for the whole listing. Reading each block instead would
    // cost 282 reads for al-Baqarah in Indonesian, and pull in 2 MB of prose.
    getSurahBlockSummaries(work.id, lang, surah),
    getTranslations("tafsir"),
    getTranslations("surahNames"),
  ]);
  if (!chapter) notFound();

  // Fall back to the committed index (no excerpts) if the summary doc hasn't
  // been written yet, so the page degrades instead of looking empty.
  const refs = listBlockRefs(lang, surah);
  const rows =
    summaries.length > 0
      ? summaries.map((s) => ({
          slug: s.slug,
          coverage: formatCoverageFromKeys(s.ayahKeys, s.ayahStart),
          excerpt: s.excerpt,
        }))
      : refs.map((r) => ({ slug: r.slug, coverage: formatCoverage(r), excerpt: "" }));

  const other = work.langs.find((l) => l !== lang);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-2">
        <Link
          href={`/tafsir/${work.id}/${lang}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("backToWork")}
        </Link>
      </div>

      <header className="mb-6 border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("workHeading")} · {t(langLabelKey(lang))}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("surahHeading", { name: chapter.name_simple })}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tNames(String(chapter.id))} ·{" "}
              {t("passageCount", { count: rows.length })}
            </p>
          </div>
          <p dir="rtl" lang="ar" className="font-arabic text-2xl sm:text-3xl">
            {chapter.name_arabic}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link
            href={`/quran/${surah}`}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t("readInQuran")}
          </Link>
          {other && (
            <Link
              href={`/tafsir/${work.id}/${other}/${surah}`}
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t("switchLanguage", { language: t(langLabelKey(other)) })}
            </Link>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.slug}>
              <Link
                href={`/tafsir/${work.id}/${lang}/${surah}/${row.slug}`}
                className="group flex flex-col gap-1 py-3 transition-colors hover:bg-muted/40"
              >
                <span className="text-sm font-medium group-hover:text-accent">
                  {row.coverage.includes("–") || row.coverage.includes(",")
                    ? t("verses", { coverage: row.coverage })
                    : t("verse", { coverage: row.coverage })}
                </span>
                {row.excerpt && (
                  <span
                    dir={lang === "ar" ? "rtl" : "ltr"}
                    lang={lang}
                    className="line-clamp-2 text-sm text-muted-foreground"
                  >
                    {row.excerpt}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Run-compress stored ayah keys, so a non-contiguous block never over-claims. */
function formatCoverageFromKeys(keys: string[], fallback: number): string {
  const ayahs = keys
    .map((k) => Number(k.slice(k.indexOf(":") + 1)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (ayahs.length === 0) return String(fallback);

  const parts: string[] = [];
  let runStart = ayahs[0] as number;
  let prev = runStart;
  const flush = (end: number) =>
    parts.push(runStart === end ? `${runStart}` : `${runStart}–${end}`);
  for (let i = 1; i < ayahs.length; i++) {
    const n = ayahs[i] as number;
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    flush(prev);
    runStart = n;
    prev = n;
  }
  flush(prev);
  return parts.join(", ");
}
