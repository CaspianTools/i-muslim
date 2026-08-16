import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { type Locale } from "@/i18n/config";
import { getSurah, getAyahsForSurah } from "@/lib/quran/db";
import { getTafsirWork, workHasLang, type TafsirLang } from "@/lib/tafsir/works";
import { getTafsirCatalogEntry } from "@/lib/tafsir/catalog";
import {
  adjacentBlockRefs,
  formatCoverage,
  getBlockRefBySlug,
  resolveBlockRef,
  type BlockRef,
} from "@/lib/tafsir/blocks";
import { getTafsirBlock } from "@/lib/tafsir/db";
import { isEditorialNote, tafsirExcerpt } from "@/lib/tafsir/render";
import { TafsirText } from "@/components/site/tafsir/TafsirText";
import { FlagContentButton } from "@/components/flags/FlagContentButton";
import { getSiteSession } from "@/lib/auth/session";
import { TafsirBlockJsonLd } from "./TafsirBlockJsonLd";

export const revalidate = 86400;

function langLabelKey(lang: TafsirLang) {
  return lang === "ar" ? "languageArabic" : "languageIndonesian";
}

function parseSurah(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 114 ? n : null;
}

/**
 * Resolve a `[range]` segment to its block.
 *
 * `"155-162"` and `"255"` are canonical. A bare ayah that sits inside a block
 * but isn't its start ("158") resolves too — that form is a deliberate public
 * entry point, so anything can deep-link to "the tafsir for 4:158" without
 * knowing where block boundaries fall, and the language switcher relies on it.
 * Non-canonical hits are reported so the page can redirect.
 */
function resolveRange(
  lang: TafsirLang,
  surah: number,
  range: string,
): { ref: BlockRef; canonical: boolean } | null {
  const exact = getBlockRefBySlug(lang, surah, range);
  if (exact) return { ref: exact, canonical: true };

  // A single ayah number inside some block.
  if (/^\d+$/.test(range)) {
    const ref = resolveBlockRef(lang, surah, Number(range));
    if (ref) return { ref, canonical: false };
  }
  // A span that overlaps a block, e.g. "155-158" against a 155–162 block.
  const span = /^(\d+)-(\d+)$/.exec(range);
  if (span) {
    const ref = resolveBlockRef(lang, surah, Number(span[1]));
    if (ref) return { ref, canonical: false };
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ work: string; lang: string; surah: string; range: string }>;
}): Promise<Metadata> {
  const { work: workId, lang, surah: surahRaw, range } = await params;
  const work = getTafsirWork(workId);
  const surah = parseSurah(surahRaw);
  if (!work || !workHasLang(work, lang) || surah == null) return {};
  const hit = resolveRange(lang, surah, range);
  if (!hit) return {};

  const [chapter, t] = await Promise.all([getSurah(surah), getTranslations("tafsir")]);
  if (!chapter) return {};
  const locale = (await getLocale()) as Locale;

  return buildPageMetadata({
    locale,
    // Always the canonical slug, never the requested token — otherwise a
    // non-canonical request would advertise itself as canonical.
    path: `/tafsir/${work.id}/${lang}/${surah}/${hit.ref.slug}`,
    title: t("blockMetaTitle", {
      name: chapter.name_simple,
      coverage: formatCoverage(hit.ref),
    }),
    description: t("blockMetaDescription", {
      name: chapter.name_simple,
      coverage: formatCoverage(hit.ref),
      language: t(langLabelKey(lang)),
    }),
    type: "article",
  });
}

export default async function TafsirBlockPage({
  params,
}: {
  params: Promise<{ work: string; lang: string; surah: string; range: string }>;
}) {
  const { work: workId, lang, surah: surahRaw, range } = await params;
  const work = getTafsirWork(workId);
  const surah = parseSurah(surahRaw);
  if (!work || !workHasLang(work, lang) || surah == null) notFound();

  const entry = getTafsirCatalogEntry(work.id, lang);
  if (entry?.renderOnSite !== true) notFound();

  const hit = resolveRange(lang, surah, range);
  if (!hit) notFound();

  const locale = await getLocale();

  if (!hit.canonical) {
    // 307, not 308: block boundaries are an ingest artefact and can shift on a
    // corpus re-release. A permanent redirect would be cached by browsers long
    // after the fix. SEO consolidation is handled by rel=canonical on the
    // destination, so the status code buys nothing here.
    // The locale-aware redirect from @/i18n/navigation, not next/navigation's:
    // localePrefix is "always", and a bare path would drop the prefix and force
    // proxy.ts to guess the locale from the cookie or Accept-Language.
    redirect({
      href: `/tafsir/${work.id}/${lang}/${surah}/${hit.ref.slug}`,
      locale,
    });
  }

  const ref = hit.ref;
  const [chapter, block, verses, t, tNames, session] = await Promise.all([
    getSurah(surah),
    getTafsirBlock(work.id, lang, ref.blockId),
    getAyahsForSurah(surah),
    getTranslations("tafsir"),
    getTranslations("surahNames"),
    getSiteSession(),
  ]);
  if (!chapter || !block) notFound();

  const coverage = formatCoverage(ref);
  const covered = new Set(ref.ayahs);
  const blockVerses = verses.filter((v) => covered.has(v.verse_number));
  const { prev, next } = adjacentBlockRefs(lang, ref);
  const other = work.langs.find((l) => l !== lang);
  const base = `/tafsir/${work.id}/${lang}/${surah}`;
  // 109 Indonesian passages are dataset placeholders ("the original does not
  // treat this verse separately"), not Ibn Kathir's words. Presenting them as
  // commentary would attribute an artefact to the author.
  const editorial = isEditorialNote(block.text, lang);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <TafsirBlockJsonLd
        work={work}
        lang={lang}
        locale={locale}
        surahName={chapter.name_simple}
        coverage={coverage}
        canonicalUrl={`/tafsir/${work.id}/${lang}/${surah}/${ref.slug}`}
        abstract={tafsirExcerpt(block.text, 300)}
        surah={surah}
        ayahStart={ref.ayahStart}
      />

      <nav className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/tafsir/${work.id}`} className="hover:text-foreground">
          {t("workHeading")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/tafsir/${work.id}/${lang}`} className="hover:text-foreground">
          {t(langLabelKey(lang))}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={base} className="hover:text-foreground">
          {chapter.name_simple}
        </Link>
      </nav>

      <header className="border-b border-border pb-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("blockMetaTitle", { name: chapter.name_simple, coverage })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tNames(String(chapter.id))} · {t(langLabelKey(lang))}
        </p>
      </header>

      {block.resolvedFrom && (
        <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t("pointerNote", { verse: `${surah}:${ref.ayahStart}` })}
        </p>
      )}

      {/* The verses the commentary is about. Makes the page self-contained —
          important for the many short single-ayah Indonesian blocks. */}
      {blockVerses.length > 0 && (
        <section className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          {blockVerses.map((v) => (
            <p
              key={v.verse_key}
              dir="rtl"
              lang="ar"
              style={{ fontSize: "var(--reader-arabic-size)" }}
              className="font-arabic leading-loose text-foreground"
            >
              {v.text_uthmani}
              <span className="ms-2 align-middle text-xs text-muted-foreground">
                {v.verse_key}
              </span>
            </p>
          ))}
        </section>
      )}

      <article className="mt-6">
        {editorial ? (
          <div className="rounded-md border border-border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("editorialNote")}
            </p>
            <p lang={lang} className="mt-2 text-sm italic text-muted-foreground">
              {block.text}
            </p>
          </div>
        ) : (
          <TafsirText text={block.text} lang={lang} honorificLabel={t("sallallahu")} />
        )}
      </article>

      <div className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>{entry.attribution}</p>
        <p className="mt-1">{entry.edition}</p>
        {entry.siteNotice && <p className="mt-1">{entry.siteNotice}</p>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <Link
          href={`/quran/${surah}#${surah}:${ref.ayahStart}`}
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t("readInQuran")}
        </Link>
        {other && (
          <Link
            href={`/tafsir/${work.id}/${other}/${surah}/${ref.ayahStart}`}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t("switchLanguage", { language: t(langLabelKey(other)) })}
          </Link>
        )}
        <FlagContentButton
          itemType="tafsir"
          itemId={`${work.id}:${lang}:${ref.blockId}`}
          reference={`${work.name} — ${chapter.name_simple} ${coverage} (${lang})`}
          href={`/tafsir/${work.id}/${lang}/${surah}/${ref.slug}`}
          locale={locale}
          signedIn={Boolean(session)}
        />
      </div>

      <nav className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        {prev ? (
          <Link
            href={`/tafsir/${work.id}/${lang}/${prev.surah}/${prev.slug}`}
            rel="prev"
            className="text-muted-foreground hover:text-foreground"
          >
            ← {t("prevPassage")}
          </Link>
        ) : (
          <span />
        )}
        <Link href={base} className="text-muted-foreground hover:text-foreground">
          {t("backToSurah", { name: chapter.name_simple })}
        </Link>
        {next ? (
          <Link
            href={`/tafsir/${work.id}/${lang}/${next.surah}/${next.slug}`}
            rel="next"
            className="text-muted-foreground hover:text-foreground"
          >
            {t("nextPassage")} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
