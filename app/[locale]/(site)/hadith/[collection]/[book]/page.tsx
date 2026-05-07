import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getHadithCollection,
  getHadithsByBook,
  type HadithDoc,
} from "@/lib/hadith/db";
import { parseLangsParam } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import { HadithCard, type HadithTranslationSlice } from "@/components/HadithCard";
import { FavoritesProvider } from "@/components/site/favorites/FavoritesContext";
import { NotesProvider } from "@/components/site/notes/NotesContext";
import { ReadingProgressTracker } from "@/components/site/reading/ReadingProgressTracker";
import { HadithSidebar } from "@/components/site/hadith/HadithSidebar";
import { HadithMobileDrawer } from "@/components/site/hadith/HadithMobileDrawer";
import { DownloadJsonButton } from "@/components/site/hadith/DownloadJsonButton";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { getSiteSession } from "@/lib/auth/session";
import { getFavoritedSet } from "@/lib/profile/data";
import { getNotesByItemType } from "@/lib/profile/notes-data";
import { getCommentCountsForEntities } from "@/lib/comments/data";
import type { HadithEntry } from "@/types/hadith";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string; book: string }>;
}) {
  const { collection, book } = await params;
  const meta = await getHadithCollection(collection);
  if (!meta) return {};
  return { title: `${meta.name_en} — Book ${book}` };
}

function docToHadithEntry(d: HadithDoc, lang: LangCode): HadithEntry | null {
  const text = lang === "ar" ? d.text_ar : d.translations?.[lang];
  if (!text) return null;
  return {
    hadithnumber: d.number,
    arabicnumber: d.arabic_number ?? d.number,
    text,
    grades: d.grades ?? (d.grade ? [{ name: "Grade", grade: d.grade }] : []),
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
  const [hadiths, languageSettings, hadithFavorites, hadithNotes, tDownload] = await Promise.all([
    getHadithsByBook(collection, bookNumber),
    getLanguageSettings(),
    session ? getFavoritedSet(session.uid, "hadith") : Promise.resolve(new Set<string>()),
    session
      ? getNotesByItemType(session.uid, "hadith")
      : Promise.resolve(new Map<string, { id: string; text: string; updatedAt: string }>()),
    getTranslations("hadithDownload"),
  ]);
  const hadithNotesRecord: Record<string, { id: string; text: string; updatedAt: string }> = {};
  for (const [k, v] of hadithNotes) hadithNotesRecord[k] = v;

  const commentCounts = await getCommentCountsForEntities(
    "hadith",
    hadiths.map((h) => `${collection}:${h.number}`),
  );

  const prev = meta.books.find((b) => b.number === bookNumber - 1);
  const next = meta.books.find((b) => b.number === bookNumber + 1);
  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";

  const collectionShortName = meta.short_name ?? meta.name_en;

  return (
    <FavoritesProvider
      initialItems={[{ itemType: "hadith", itemIds: Array.from(hadithFavorites) }]}
    >
      <NotesProvider initialItems={[{ itemType: "hadith", notes: hadithNotesRecord }]}>
      <ReadingProgressTracker
        variant={{ kind: "hadith", collection, book: bookNumber }}
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="flex items-center gap-2 pb-3 md:hidden">
          <HadithMobileDrawer availableLangs={languageSettings.hadithEnabled} />
        </div>
        <div className="flex gap-6">
          <aside className="hidden md:block sticky top-20 self-start">
            <HadithSidebar variant="desktop" availableLangs={languageSettings.hadithEnabled} />
          </aside>
          <div className="min-w-0 flex-1">
            <div className="mx-auto max-w-3xl">
              <Link
                href={`/hadith/${collection}${langQS}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                ← {meta.name_en}
              </Link>

              <header className="mt-4 border-b border-border pb-6">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {meta.name_en} · Book {bookNumber}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {bookMeta.name}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hadiths.length} hadith in this book.
                </p>
                <div className="mt-4">
                  <DownloadJsonButton
                    href={`/api/hadith/${collection}/${bookNumber}/download`}
                    filename={`${collection}-book-${bookNumber}.json`}
                    label={tDownload("buttonBook")}
                  />
                </div>
              </header>

              <div className="mt-6 space-y-4">
                {hadiths.map((h) => {
                  const arabic = showArabic ? docToHadithEntry(h, "ar") : null;
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
                      const native = docToHadithEntry(h, lang);
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
                      lang !== "en" && isPublished("en") ? docToHadithEntry(h, "en") : null;
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
                  return (
                    <HadithCard
                      key={h.number}
                      number={h.number}
                      arabic={arabic}
                      translations={translations}
                      collectionShortName={collectionShortName}
                      collectionId={collection}
                      collectionName={meta.name_en}
                      bookNumber={bookNumber}
                      bookName={bookMeta.name}
                      locale={locale}
                      signedIn={Boolean(session)}
                      currentUid={session?.uid ?? null}
                      commentCount={commentCounts.get(`${collection}:${h.number}`) ?? 0}
                    />
                  );
                })}
              </div>

              <nav className="mt-8 flex items-center justify-between gap-2 text-sm">
                {prev ? (
                  <Link
                    href={`/hadith/${collection}/${prev.number}${langQS}`}
                    className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
                  >
                    ← Book {prev.number}
                  </Link>
                ) : (
                  <span />
                )}
                {next ? (
                  <Link
                    href={`/hadith/${collection}/${next.number}${langQS}`}
                    className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
                  >
                    Book {next.number} →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            </div>
          </div>
        </div>
      </div>
      </NotesProvider>
    </FavoritesProvider>
  );
}
