import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookOpen, BookOpenCheck, CheckCircle2, Library } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSiteSession } from "@/lib/auth/session";
import { getReadingProgress } from "@/lib/profile/data";
import { getReadsSummary } from "@/lib/reads/data";
import { getHadithCollections } from "@/lib/hadith/db";
import { getSurahs } from "@/lib/quran/db";
import { formatRelative } from "@/lib/utils";
import { ResetReadsButton } from "@/components/site/reads/ResetReadsButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reading");
  return { title: t("title") };
}

const TOTAL_SURAHS = 114;

export default async function ReadingProgressPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/profile/reading");

  const [t, tNav, tReads, progress, summary, collections, surahs] = await Promise.all([
    getTranslations("reading"),
    getTranslations("profileNav"),
    getTranslations("reads"),
    getReadingProgress(session.uid),
    getReadsSummary(session.uid),
    getHadithCollections(),
    getSurahs(),
  ]);

  const collectionNames = new Map(
    collections.map((c) => [c.slug, { name: c.name_en, total: c.total, books: c.books }]),
  );
  const surahNames = new Map(surahs.map((s) => [s.id, s.name_simple]));

  const cards: Array<{
    icon: typeof BookOpenCheck;
    label: string;
    title: string;
    href: string;
    viewedAt: string;
  }> = [];

  if (progress.lastQuranAyah) {
    cards.push({
      icon: BookOpenCheck,
      label: t("lastQuranAyah"),
      title: progress.lastQuranAyah.verseKey,
      href: `/quran/${progress.lastQuranAyah.surah}#${progress.lastQuranAyah.verseKey}`,
      viewedAt: progress.lastQuranAyah.viewedAt,
    });
  }
  if (progress.lastSurah) {
    cards.push({
      icon: BookOpen,
      label: t("lastSurah"),
      title: `Surah ${progress.lastSurah.surah}`,
      href: `/quran/${progress.lastSurah.surah}`,
      viewedAt: progress.lastSurah.viewedAt,
    });
  }
  if (progress.lastHadith) {
    cards.push({
      icon: Library,
      label: t("lastHadith"),
      title: `${progress.lastHadith.collection} · Book ${progress.lastHadith.book} · #${progress.lastHadith.number}`,
      href: `/hadith/${progress.lastHadith.collection}/${progress.lastHadith.book}#hadith-${progress.lastHadith.number}`,
      viewedAt: progress.lastHadith.viewedAt,
    });
  }

  const hasAnyMarks =
    summary.quran.surahsRead > 0 || summary.hadith.total > 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {tNav("items.reading")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{tReads("progressHeading")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tReads("progressDescription")}</p>
          </div>
          {hasAnyMarks && <ResetReadsButton />}
        </div>

        {!hasAnyMarks ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            {tReads("progressEmpty")}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <BookOpen className="size-4" />
                    {tReads("quranSectionLabel")}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {tReads("quranCount", {
                      read: summary.quran.surahsRead,
                      total: TOTAL_SURAHS,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tReads("quranCountSubtitle", {
                      percent: Math.round(
                        (summary.quran.surahsRead / TOTAL_SURAHS) * 100,
                      ),
                    })}
                  </p>
                </div>
                {summary.quran.surahsRead === TOTAL_SURAHS && (
                  <CheckCircle2 className="size-6 text-emerald-500" aria-hidden />
                )}
              </div>

              {summary.quran.latest && (
                <div className="mt-4 rounded-md border border-border bg-background p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {tReads("latestLabel")}
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {surahNames.get(summary.quran.latest.surahId) ??
                      `Surah ${summary.quran.latest.surahId}`}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t("viewedAt", { when: formatRelative(summary.quran.latest.at) })}
                  </div>
                  <Link
                    href={`/quran/${summary.quran.latest.surahId}`}
                    className="mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {tReads("jumpToLatest")}
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Library className="size-4" />
                    {tReads("hadithSectionLabel")}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {tReads("hadithCount", { total: summary.hadith.total })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tReads("hadithCountSubtitle", {
                      collections: Object.keys(summary.hadith.byCollection).length,
                    })}
                  </p>
                </div>
              </div>

              {summary.hadith.latest && (
                <div className="mt-4 rounded-md border border-border bg-background p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {tReads("latestLabel")}
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {collectionNames.get(summary.hadith.latest.collection)?.name ??
                      summary.hadith.latest.collection}{" "}
                    · #{summary.hadith.latest.number}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t("viewedAt", { when: formatRelative(summary.hadith.latest.at) })}
                  </div>
                  <Link
                    href={`/hadith/${summary.hadith.latest.collection}/${summary.hadith.latest.number}`}
                    className="mt-3 inline-flex w-fit items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {tReads("jumpToLatest")}
                  </Link>
                </div>
              )}

              {Object.keys(summary.hadith.byCollection).length > 0 && (
                <ul className="mt-4 space-y-2">
                  {Object.entries(summary.hadith.byCollection)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([slug, col]) => {
                      const meta = collectionNames.get(slug);
                      const total = meta?.total ?? 0;
                      const booksRead = Object.keys(col.byBook).length;
                      const booksTotal = meta?.books.length ?? 0;
                      const allRead = total > 0 && col.total >= total;
                      return (
                        <li
                          key={slug}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {allRead && (
                                <CheckCircle2
                                  className="size-4 text-emerald-500"
                                  aria-hidden
                                />
                              )}
                              <span className="font-medium text-foreground">
                                {meta?.name ?? slug}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {tReads("collectionBreakdown", {
                                read: col.total,
                                total,
                                books: booksRead,
                                booksTotal,
                              })}
                            </div>
                          </div>
                          {col.latest && (
                            <Link
                              href={`/hadith/${slug}/${col.latest.number}`}
                              className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              {tReads("jumpToLatestShort")}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">{tReads("autoTrackedHeading")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("pageDescription")}</p>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <li
                  key={card.label}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Icon className="size-4" />
                    {card.label}
                  </div>
                  <div className="text-lg font-semibold text-foreground">{card.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("viewedAt", { when: formatRelative(card.viewedAt) })}
                  </div>
                  <Link
                    href={card.href}
                    className="inline-flex w-fit items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {t("resume")}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
