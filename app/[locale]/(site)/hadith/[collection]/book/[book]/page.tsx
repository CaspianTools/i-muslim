import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getHadithCollection,
  getHadithsByBook,
  type HadithDoc,
} from "@/lib/hadith/db";
import { parseLangsParam } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { type Locale } from "@/i18n/config";
import { HadithCard, type HadithTranslationSlice } from "@/components/HadithCard";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { FavoritesProvider } from "@/components/site/favorites/FavoritesContext";
import { NotesProvider } from "@/components/site/notes/NotesContext";
import { ReadsProvider } from "@/components/site/reads/ReadsContext";
import { ReadingProgressTracker } from "@/components/site/reading/ReadingProgressTracker";
import { ReadingModeBoundary } from "@/components/site/reading/ReadingModeBoundary";
import { ReadingModeToggle } from "@/components/site/reading/ReadingModeToggle";
import { HadithSidebar } from "@/components/site/hadith/HadithSidebar";
import { HadithFiltersButton } from "@/components/site/hadith/HadithFiltersButton";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { getSiteSession } from "@/lib/auth/session";
import { getFavoritedSet } from "@/lib/profile/data";
import {
  getFavoriteCountsForHadiths,
  getFavoriteStats,
} from "@/lib/profile/favoriteStats";
import { getReadSet } from "@/lib/reads/data";
import { getNotesByItemType } from "@/lib/profile/notes-data";
import { getCommentCountsForEntities } from "@/lib/comments/data";
import type { HadithEntry } from "@/types/hadith";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string; book: string }>;
}): Promise<Metadata> {
  const { collection, book } = await params;
  const meta = await getHadithCollection(collection);
  if (!meta) return {};
  const [t, tCollections, tBookNames] = await Promise.all([
    getTranslations("hadithPage"),
    getTranslations("hadithCollectionNames"),
    getTranslations("hadithBookNames"),
  ]);
  const collectionName = tCollections.has(collection)
    ? tCollections(collection)
    : meta.name_en;
  const bookKey = `${collection}.${book}` as const;
  const bookName = tBookNames.has(bookKey)
    ? tBookNames(bookKey)
    : meta.books.find((b) => b.number === Number(book))?.name ?? `Book ${book}`;
  const locale = (await getLocale()) as Locale;
  return buildPageMetadata({
    locale,
    path: `/hadith/${collection}/book/${book}`,
    title: t("bookMetaTitle", { name: collectionName, book: `${book} — ${bookName}` }),
  });
}

function docToHadithEntry(
  d: HadithDoc,
  lang: LangCode,
  gradeLabel: string,
): HadithEntry | null {
  const text = lang === "ar" ? d.text_ar : d.translations?.[lang];
  if (!text) return null;
  return {
    hadithnumber: d.number,
    arabicnumber: d.arabic_number ?? d.number,
    text,
    grades: d.grades ?? (d.grade ? [{ name: gradeLabel, grade: d.grade }] : []),
    reference: { book: d.book, hadith: d.hadith_in_book ?? d.number },
  };
}

export default async function HadithBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string; book: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { collection, book } = await params;
  const { lang: langParam } = await searchParams;
  const meta = await getHadithCollection(collection);
  if (!meta) notFound();

  const bookNumber = Number(book);
  if (!Number.isInteger(bookNumber) || bookNumber < 1) notFound();

  const langs = parseLangsParam(langParam);
  const nonArabic = langs.filter((l): l is Exclude<LangCode, "ar"> => l !== "ar");
  const showArabic = langs.includes("ar");

  const bookMeta = meta.books.find((b) => b.number === bookNumber);
  if (!bookMeta) notFound();

  const session = await getSiteSession();
  const locale = await getLocale();
  const [
    hadiths,
    languageSettings,
    hadithFavorites,
    bookFavorites,
    hadithReads,
    hadithNotes,
    bookNotes,
    t,
    tCollections,
    tBookNames,
    tCard,
  ] = await Promise.all([
    getHadithsByBook(collection, bookNumber),
    getLanguageSettings(),
    session ? getFavoritedSet(session.uid, "hadith") : Promise.resolve(new Set<string>()),
    session
      ? getFavoritedSet(session.uid, "hadithBook")
      : Promise.resolve(new Set<string>()),
    session ? getReadSet(session.uid, "hadith") : Promise.resolve(new Set<string>()),
    session
      ? getNotesByItemType(session.uid, "hadith")
      : Promise.resolve(new Map<string, { id: string; text: string; updatedAt: string }>()),
    session
      ? getNotesByItemType(session.uid, "hadithBook")
      : Promise.resolve(new Map<string, { id: string; text: string; updatedAt: string }>()),
    getTranslations("hadithPage"),
    getTranslations("hadithCollectionNames"),
    getTranslations("hadithBookNames"),
    getTranslations("hadithCard"),
  ]);
  const hadithNotesRecord: Record<string, { id: string; text: string; updatedAt: string }> = {};
  for (const [k, v] of hadithNotes) hadithNotesRecord[k] = v;
  const bookNotesRecord: Record<string, { id: string; text: string; updatedAt: string }> = {};
  for (const [k, v] of bookNotes) bookNotesRecord[k] = v;

  const hadithKeys = hadiths.map((h) => `${collection}:${h.number}`);
  const bookId = `${collection}:${bookNumber}`;
  const [commentCounts, hadithFavoriteCounts, bookFavoriteStats] = await Promise.all([
    getCommentCountsForEntities("hadith", hadithKeys),
    getFavoriteCountsForHadiths(hadithKeys),
    getFavoriteStats("hadithBook", bookId),
  ]);

  const prev = meta.books.find((b) => b.number === bookNumber - 1);
  const next = meta.books.find((b) => b.number === bookNumber + 1);
  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";

  const collectionShortName = meta.short_name ?? meta.name_en;
  const localizedCollectionName = tCollections.has(collection)
    ? tCollections(collection)
    : meta.name_en;
  const bookKey = `${collection}.${bookNumber}` as const;
  const localizedBookName = tBookNames.has(bookKey)
    ? tBookNames(bookKey)
    : bookMeta.name;
  const gradeLabel = tCard("gradeTooltip");

  return (
    <FavoritesProvider
      initialItems={[
        { itemType: "hadith", itemIds: Array.from(hadithFavorites) },
        { itemType: "hadithBook", itemIds: Array.from(bookFavorites) },
      ]}
    >
      <ReadsProvider
        initialReadIds={Array.from(hadithReads)}
        subscribeToLocalStorage={!session}
      >
      <NotesProvider
        initialItems={[
          { itemType: "hadith", notes: hadithNotesRecord },
          { itemType: "hadithBook", notes: bookNotesRecord },
        ]}
      >
      <ReadingModeBoundary scope="hadith" />
      <ReadingProgressTracker
        variant={{ kind: "hadith", collection, book: bookNumber }}
      />
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-10">
        <div className="flex gap-6">
          <aside className="hidden md:block sticky top-20 self-start">
            <HadithSidebar variant="desktop" availableLangs={languageSettings.hadithEnabled} />
          </aside>
          <div className="min-w-0 flex-1">
            <div data-reading-hide>
              <Link
                href={`/hadith/${collection}${langQS}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                ← {localizedCollectionName}
              </Link>
            </div>

            <header className="mt-3 border-b border-border pb-4 sm:mt-4 sm:pb-6">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div data-reading-hide className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("bookEyebrow", {
                      collection: localizedCollectionName,
                      book: bookNumber,
                    })}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {localizedBookName}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("bookSummary", { count: hadiths.length })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 sm:mt-4">
                <FavoriteButton
                  itemType="hadithBook"
                  itemId={bookId}
                  itemMeta={{
                    title: `${localizedCollectionName} — ${localizedBookName}`,
                    subtitle: collectionShortName,
                    href: `/hadith/${collection}/book/${bookNumber}`,
                    locale,
                  }}
                  signedIn={Boolean(session)}
                  size="md"
                  count={bookFavoriteStats.count}
                />
                <ReadingModeToggle scope="hadith" />
                <HadithFiltersButton availableLangs={languageSettings.hadithEnabled} />
              </div>
            </header>

            <div className="mt-4 sm:mt-6">
              {hadiths.map((h) => {
                const arabic = showArabic ? docToHadithEntry(h, "ar", gradeLabel) : null;
                const isPublished = (lang: LangCode) =>
                  h.publishedTranslations?.[lang] === true;
                const translations: HadithTranslationSlice[] = nonArabic.map((lang) => {
                  // Per-language gate: a translation is only shown to the
                  // public reader once the admin has flipped it to Published.
                  // For Draft we explicitly mark the slice "in_process" so
                  // HadithCard renders an "under review" placeholder rather
                  // than silently substituting English (the user requirement).
                  const rawText = h.translations?.[lang];
                  if (rawText && isPublished(lang)) {
                    const native = docToHadithEntry(h, lang, gradeLabel);
                    if (native) {
                      return { requested: lang, actual: lang, entry: native, fallback: false };
                    }
                  }
                  if (rawText) {
                    // Translation exists but is still Draft — never render the
                    // unreviewed text and never fall back to English.
                    return {
                      requested: lang,
                      actual: null,
                      entry: null,
                      fallback: false,
                      status: "in_process",
                    };
                  }
                  // No translation in this language yet. Fall back to English
                  // only if English itself is Published.
                  const enEntry =
                    lang !== "en" && isPublished("en")
                      ? docToHadithEntry(h, "en", gradeLabel)
                      : null;
                  if (enEntry) {
                    return { requested: lang, actual: "en", entry: enEntry, fallback: true };
                  }
                  return {
                    requested: lang,
                    actual: null,
                    entry: null,
                    fallback: false,
                    status: "in_process",
                  };
                });
                const hadithKey = `${collection}:${h.number}`;
                return (
                  <HadithCard
                    key={h.number}
                    number={h.number}
                    arabic={arabic}
                    translations={translations}
                    collectionShortName={collectionShortName}
                    collectionId={collection}
                    collectionName={localizedCollectionName}
                    bookNumber={bookNumber}
                    bookName={localizedBookName}
                    locale={locale}
                    signedIn={Boolean(session)}
                    currentUid={session?.uid ?? null}
                    commentCount={commentCounts.get(hadithKey) ?? 0}
                    favoriteCount={hadithFavoriteCounts.get(hadithKey) ?? 0}
                    permalink
                    permalinkLabel={t("singleOpenPermalink")}
                  />
                );
              })}
            </div>

            <nav className="mt-8 flex items-center justify-between gap-2 text-sm">
              {prev ? (
                <Link
                  href={`/hadith/${collection}/book/${prev.number}${langQS}`}
                  className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
                >
                  {t("prevBook", { n: prev.number })}
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link
                  href={`/hadith/${collection}/book/${next.number}${langQS}`}
                  className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
                >
                  {t("nextBook", { n: next.number })}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          </div>
        </div>
      </div>
      </NotesProvider>
      </ReadsProvider>
    </FavoritesProvider>
  );
}
