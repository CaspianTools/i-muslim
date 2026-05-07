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
import { getLocale } from "next-intl/server";
import { AyahCard } from "@/components/AyahCard";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { FavoritesProvider } from "@/components/site/favorites/FavoritesContext";
import { NotesProvider } from "@/components/site/notes/NotesContext";
import { ReadingProgressTracker } from "@/components/site/reading/ReadingProgressTracker";
import { QuranSidebar } from "@/components/site/quran/QuranSidebar";
import { QuranMobileDrawer } from "@/components/site/quran/QuranMobileDrawer";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { getSiteSession } from "@/lib/auth/session";
import { getFavoritedSet } from "@/lib/profile/data";
import { getNotesByItemType } from "@/lib/profile/notes-data";
import { getCommentCountsForAyahs } from "@/lib/comments/data";
import { CommentThread } from "@/components/comments/CommentThread";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ surah: string }>;
}) {
  const { surah } = await params;
  const id = Number(surah);
  if (!Number.isInteger(id) || id < 1 || id > 114) return {};
  try {
    const chapter = await getSurah(id);
    if (!chapter) return {};
    return {
      title: `Surah ${chapter.name_simple} (${id})`,
      description: `Read Surah ${chapter.name_simple} — ${chapter.translated_name.name}. ${chapter.verses_count} verses.`,
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
  ]);
  const ayahNotesRecord: Record<string, { id: string; text: string; updatedAt: string }> = {};
  for (const [k, v] of ayahNotes) ayahNotesRecord[k] = v;
  if (!chapter) notFound();
  const verses = allVerses.map((v) => filterVerseLangs(v, langs));
  const commentCounts = await getCommentCountsForAyahs(
    id,
    verses.map((v) => v.verse_number),
  );

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
      <ReadingProgressTracker variant={{ kind: "quran", surah: id }} />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="flex items-center gap-2 pb-3 md:hidden">
          <QuranMobileDrawer availableLangs={languageSettings.quranEnabled} />
        </div>
        <div className="flex gap-6">
          <aside className="hidden md:block sticky top-20 self-start">
            <QuranSidebar variant="desktop" availableLangs={languageSettings.quranEnabled} />
          </aside>
          <div className="min-w-0 flex-1">
            <Link
              href="/quran"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              ← All surahs
            </Link>

            <header className="mt-4 border-b border-border pb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Surah {chapter.id}
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                    {chapter.name_simple}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {chapter.translated_name.name} · {chapter.verses_count} verses ·{" "}
                    {chapter.revelation_place === "makkah" ? "Makkan" : "Madinan"}
                  </p>
                </div>
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-4xl text-foreground"
                >
                  {chapter.name_arabic}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <FavoriteButton
                  itemType="surah"
                  itemId={surahId}
                  itemMeta={{
                    title: `Surah ${chapter.name_simple}`,
                    subtitle: chapter.translated_name.name,
                    href: surahHref,
                    arabic: chapter.name_arabic,
                    locale,
                  }}
                  signedIn={Boolean(session)}
                  size="md"
                />
              </div>
            </header>

            {chapter.bismillah_pre && chapter.id !== 1 && chapter.id !== 9 && (
              <p
                dir="rtl"
                lang="ar"
                className="mt-6 text-center font-arabic text-2xl text-accent sm:text-3xl"
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
              </p>
            )}

            <div className="mt-6 space-y-4">
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
                />
              ))}
            </div>

            <CommentThread
              entityType="surah"
              entityId={surahId}
              itemMeta={{
                title: `Surah ${chapter.name_simple}`,
                subtitle: chapter.translated_name.name,
                href: surahHref,
                locale,
              }}
            />

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
