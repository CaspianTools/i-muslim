import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSurah,
  getSurahs,
  getAyahsForSurah,
  filterVerseLangs,
} from "@/lib/quran/db";
import { SurahPagination } from "@/components/site/quran/SurahPagination";
import { parseLangsParam } from "@/lib/translations";
import { getLocale, getTranslations } from "next-intl/server";
import { AyahCard } from "@/components/AyahCard";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { FavoritesProvider } from "@/components/site/favorites/FavoritesContext";
import { NotesProvider } from "@/components/site/notes/NotesContext";
import { ReadingProgressTracker } from "@/components/site/reading/ReadingProgressTracker";
import { ReadingModeBoundary } from "@/components/site/reading/ReadingModeBoundary";
import { ReadingModeToggle } from "@/components/site/reading/ReadingModeToggle";
import { QuranSidebarAside } from "@/components/site/quran/QuranSidebarAside";
import { QuranFiltersButton } from "@/components/site/quran/QuranFiltersButton";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { getSiteSession } from "@/lib/auth/session";
import { getFavoritedSet } from "@/lib/profile/data";
import {
  getFavoriteCountsForAyahs,
  getFavoriteStats,
} from "@/lib/profile/favoriteStats";
import { getNotesByItemType } from "@/lib/profile/notes-data";
import { getCommentCountsForAyahs } from "@/lib/comments/data";
import { CommentThread } from "@/components/comments/CommentThread";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surah: string }>;
}): Promise<Metadata> {
  const { surah } = await params;
  const id = Number(surah);
  if (!Number.isInteger(id) || id < 1 || id > 114) return {};
  try {
    const [chapter, t, tNames] = await Promise.all([
      getSurah(id),
      getTranslations("quranPage"),
      getTranslations("surahNames"),
    ]);
    if (!chapter) return {};
    const translatedName = tNames(String(chapter.id));
    return {
      title: t("surahMetaTitle", { name: chapter.name_simple, id }),
      description: t("surahMetaDescription", {
        name: chapter.name_simple,
        translatedName,
        verses: t("verseCount", { count: chapter.verses_count }),
      }),
    };
  } catch {
    return {};
  }
}

export default async function SurahPage({
  params,
  searchParams,
}: {
  params: Promise<{ surah: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { surah } = await params;
  const { lang: langParam } = await searchParams;
  const id = Number(surah);
  if (!Number.isInteger(id) || id < 1 || id > 114) notFound();

  const langs = parseLangsParam(langParam);
  const session = await getSiteSession();
  const locale = await getLocale();
  const [
    chapter,
    allVerses,
    chapters,
    languageSettings,
    ayahFavorites,
    surahFavorites,
    ayahNotes,
    t,
    tNames,
  ] = await Promise.all([
    getSurah(id),
    getAyahsForSurah(id),
    getSurahs(),
    getLanguageSettings(),
    session ? getFavoritedSet(session.uid, "ayah") : Promise.resolve(new Set<string>()),
    session ? getFavoritedSet(session.uid, "surah") : Promise.resolve(new Set<string>()),
    session
      ? getNotesByItemType(session.uid, "ayah")
      : Promise.resolve(new Map<string, { id: string; text: string; updatedAt: string }>()),
    getTranslations("quranPage"),
    getTranslations("surahNames"),
  ]);
  const ayahNotesRecord: Record<string, { id: string; text: string; updatedAt: string }> = {};
  for (const [k, v] of ayahNotes) ayahNotesRecord[k] = v;
  if (!chapter) notFound();
  const verses = allVerses.map((v) => filterVerseLangs(v, langs));
  const verseKeys = verses.map((v) => v.verse_key);
  const [commentCounts, ayahFavoriteCounts, surahFavoriteStats] = await Promise.all([
    getCommentCountsForAyahs(id, verses.map((v) => v.verse_number)),
    getFavoriteCountsForAyahs(verseKeys),
    getFavoriteStats("surah", String(id)),
  ]);
  const localizedMeaning = tNames(String(chapter.id));

  const prev = chapters.find((c) => c.id === id - 1);
  const next = chapters.find((c) => c.id === id + 1);
  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";

  const surahId = String(id);
  const surahHref = `/quran/${id}`;

  return (
    <FavoritesProvider
      initialItems={[
        { itemType: "ayah", itemIds: Array.from(ayahFavorites) },
        { itemType: "surah", itemIds: Array.from(surahFavorites) },
      ]}
    >
      <NotesProvider initialItems={[{ itemType: "ayah", notes: ayahNotesRecord }]}>
      <ReadingModeBoundary scope="quran" />
      <ReadingProgressTracker variant={{ kind: "quran", surah: id }} />
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-10">
        <div className="flex gap-6">
          <QuranSidebarAside availableLangs={languageSettings.quranEnabled} />
          <div className="min-w-0 flex-1">
            <div data-reading-hide>
              <Link
                href="/quran"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("backToSurahs")}
              </Link>
            </div>

            <header className="mt-3 border-b border-border pb-4 sm:mt-4 sm:pb-6">
              <div data-reading-hide className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("surahEyebrow", { id: chapter.id })}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {chapter.name_simple}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("surahSummary", {
                      translatedName: localizedMeaning,
                      verses: t("verseCount", { count: chapter.verses_count }),
                      revelation:
                        chapter.revelation_place === "makkah"
                          ? t("revelationMakkan")
                          : t("revelationMadinan"),
                    })}
                  </p>
                </div>
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-2xl text-foreground sm:text-4xl"
                >
                  {chapter.name_arabic}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 sm:mt-4">
                <div data-reading-hide className="contents">
                  <FavoriteButton
                    itemType="surah"
                    itemId={surahId}
                    itemMeta={{
                      title: `Surah ${chapter.name_simple}`,
                      subtitle: localizedMeaning,
                      href: surahHref,
                      arabic: chapter.name_arabic,
                      locale,
                    }}
                    signedIn={Boolean(session)}
                    size="md"
                    count={surahFavoriteStats.count}
                  />
                </div>
                <ReadingModeToggle scope="quran" />
                <QuranFiltersButton availableLangs={languageSettings.quranEnabled} />
              </div>
            </header>

            {chapter.bismillah_pre && chapter.id !== 1 && chapter.id !== 9 && (
              <p
                dir="rtl"
                lang="ar"
                className="mt-4 text-center font-arabic text-2xl text-accent sm:mt-6 sm:text-3xl"
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
              </p>
            )}

            <div className="mt-4 sm:mt-6">
              {verses.map((v) => (
                <AyahCard
                  key={v.id}
                  verse={v}
                  langs={langs}
                  surahId={id}
                  surahName={chapter.name_simple}
                  locale={locale}
                  signedIn={Boolean(session)}
                  currentUid={session?.uid ?? null}
                  commentCount={commentCounts.get(v.verse_key) ?? 0}
                  favoriteCount={ayahFavoriteCounts.get(v.verse_key) ?? 0}
                />
              ))}
            </div>

            <div data-reading-hide>
              <CommentThread
                entityType="surah"
                entityId={surahId}
                itemMeta={{
                  title: `Surah ${chapter.name_simple}`,
                  subtitle: localizedMeaning,
                  href: surahHref,
                  locale,
                }}
              />
            </div>

            <SurahPagination
              current={id}
              total={chapters.length}
              prev={prev}
              next={next}
              qs={langQS}
            />
          </div>
        </div>
      </div>
      </NotesProvider>
    </FavoritesProvider>
  );
}
