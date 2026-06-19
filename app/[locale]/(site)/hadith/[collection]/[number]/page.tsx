import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getHadith,
  getHadithCollection,
  getAdjacentHadithNumbers,
} from "@/lib/hadith/db";
import { parseLangsParam, type LangCode } from "@/lib/translations";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HadithCard, type HadithTranslationSlice } from "@/components/HadithCard";
import { FavoritesProvider } from "@/components/site/favorites/FavoritesContext";
import { NotesProvider } from "@/components/site/notes/NotesContext";
import { ReadsProvider } from "@/components/site/reads/ReadsContext";
import { HadithSidebar } from "@/components/site/hadith/HadithSidebar";
import { HadithMobileDrawer } from "@/components/site/hadith/HadithMobileDrawer";
import {
  HadithDetailTabs,
  HADITH_DETAIL_TABS_ANCHOR,
} from "@/components/site/hadith/HadithDetailTabs";
import { InlineNoteEditor } from "@/components/site/notes/InlineNoteEditor";
import { CommentThread } from "@/components/comments/CommentThread";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { getSiteSession } from "@/lib/auth/session";
import { getFavoritedSet } from "@/lib/profile/data";
import { getReadSet } from "@/lib/reads/data";
import { getNotesByItemType } from "@/lib/profile/notes-data";
import { getCommentCountsForEntities } from "@/lib/comments/data";
import type { HadithEntry } from "@/types/hadith";
import { HadithJsonLd } from "./HadithJsonLd";

export const revalidate = 86400;

function resolveSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "http://localhost:7777";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}
const SITE_URL = resolveSiteUrl();

type Params = { collection: string; number: string };

function parseNumber(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function snippet(text: string, max = 155): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max);
  const lastSentence = slice.lastIndexOf(". ");
  const cut = lastSentence > 80 ? lastSentence + 1 : slice.lastIndexOf(" ");
  return (cut > 60 ? slice.slice(0, cut) : slice).trimEnd() + "…";
}

// Active-locale translation resolution. Same Draft/Published gate as the book
// page — never render unreviewed text, never silently substitute English.
type ResolvedTranslation = {
  // Text used for visible rendering in the active locale (null if no Published
  // translation in this locale).
  visibleText: string | null;
  // Text used for <meta description> and JSON-LD articleBody. Falls back to
  // English Published, then Arabic, so the schema body always has content.
  bodyText: string;
  bodyLanguage: string;
  // True if we have Published content in the active locale specifically.
  hasNativeTranslation: boolean;
};

function resolveTranslation(
  doc: {
    text_ar: string;
    translations: Record<string, string | undefined>;
    publishedTranslations?: Record<string, boolean>;
  },
  lang: LangCode,
): ResolvedTranslation {
  const isPublished = (l: LangCode) => doc.publishedTranslations?.[l] === true;
  const tryLang = (l: LangCode): string | null => {
    if (l === "ar") return doc.text_ar || null;
    const raw = doc.translations?.[l];
    if (raw && isPublished(l)) return raw;
    return null;
  };
  const native = tryLang(lang);
  if (native) {
    return {
      visibleText: native,
      bodyText: native,
      bodyLanguage: lang,
      hasNativeTranslation: true,
    };
  }
  // No Published translation in active locale. Body falls back to English
  // Published, else to Arabic, so JSON-LD articleBody is never empty.
  const en = lang !== "en" ? tryLang("en") : null;
  if (en) {
    return {
      visibleText: null,
      bodyText: en,
      bodyLanguage: "en",
      hasNativeTranslation: false,
    };
  }
  return {
    visibleText: null,
    bodyText: doc.text_ar,
    bodyLanguage: "ar",
    hasNativeTranslation: false,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { collection, number: numberParam } = await params;
  const number = parseNumber(numberParam);
  if (!number) return {};
  const meta = await getHadithCollection(collection);
  if (!meta) return {};
  const doc = await getHadith(collection, number);
  if (!doc || !doc.published) return {};

  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("hadithPage");
  const tCollections = await getTranslations("hadithCollectionNames");
  const collectionLabel = tCollections.has(collection)
    ? tCollections(collection)
    : meta.short_name ?? meta.name_en;
  const resolved = resolveTranslation(doc, locale as LangCode);

  const title = doc.narrator
    ? t("singleMetaTitle", {
        collection: collectionLabel,
        number,
        narrator: doc.narrator,
      })
    : t("singleMetaTitleNoNarrator", { collection: collectionLabel, number });

  const description = resolved.hasNativeTranslation
    ? t("singleMetaDescription", {
        snippet: snippet(resolved.bodyText),
        collection: collectionLabel,
        number,
      })
    : t("singleMetaDescriptionFallback", {
        collection: collectionLabel,
        number,
      });

  return buildPageMetadata({
    locale,
    path: `/hadith/${collection}/${number}`,
    title,
    description,
    type: "article",
  });
}

export default async function HadithDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { collection, number: numberParam } = await params;
  const { lang: langParam } = await searchParams;
  const number = parseNumber(numberParam);
  if (!number) notFound();

  const meta = await getHadithCollection(collection);
  if (!meta) notFound();

  const doc = await getHadith(collection, number);
  if (!doc || !doc.published) {
    // Legacy book URL fallback: if this number isn't a hadith but IS a known
    // book number in this collection, preserve the old bookmark by 308'ing
    // to the new /book/<n> URL.
    const isBookNumber = meta.books.some((b) => b.number === number);
    if (isBookNumber) {
      permanentRedirect(`/hadith/${collection}/book/${number}`);
    }
    notFound();
  }

  const bookMeta = meta.books.find((b) => b.number === doc.book);
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("hadithPage");
  const tCollections = await getTranslations("hadithCollectionNames");
  const tBookNames = await getTranslations("hadithBookNames");
  // Localized names, mirroring the collection/book pages: prefer the
  // hadithCollectionNames / hadithBookNames message keys, fall back to the
  // English Firestore name when a key is absent.
  const localizedCollectionName = tCollections.has(collection)
    ? tCollections(collection)
    : meta.name_en;
  const bookNameKey = `${collection}.${doc.book}` as const;
  const localizedBookName = tBookNames.has(bookNameKey)
    ? tBookNames(bookNameKey)
    : bookMeta?.name ?? `Book ${doc.book}`;
  const collectionShortName = localizedCollectionName;
  const collectionLabel = localizedCollectionName;

  const resolved = resolveTranslation(doc, locale as LangCode);
  const session = await getSiteSession();

  const [
    languageSettings,
    hadithFavorites,
    hadithReads,
    hadithNotes,
    adjacent,
    commentCounts,
  ] = await Promise.all([
    getLanguageSettings(),
    session ? getFavoritedSet(session.uid, "hadith") : Promise.resolve(new Set<string>()),
    session ? getReadSet(session.uid, "hadith") : Promise.resolve(new Set<string>()),
    session
      ? getNotesByItemType(session.uid, "hadith")
      : Promise.resolve(new Map<string, { id: string; text: string; updatedAt: string }>()),
    getAdjacentHadithNumbers(collection, number),
    getCommentCountsForEntities("hadith", [`${collection}:${number}`]),
  ]);

  const hadithNotesRecord: Record<string, { id: string; text: string; updatedAt: string }> = {};
  for (const [k, v] of hadithNotes) hadithNotesRecord[k] = v;

  // Honour the ?lang= viewing preference (set by the sidebar's
  // HadithLanguageFilter). Mirrors the book page's resolution: showArabic
  // toggles the Arabic block, nonArabic drives one HadithTranslationSlice
  // per requested language with the same Draft/Published gate (never render
  // unreviewed text; English fallback only when English itself is Published).
  const langs = parseLangsParam(langParam);
  const nonArabic = langs.filter((l): l is Exclude<LangCode, "ar"> => l !== "ar");
  const showArabic = langs.includes("ar");

  const baseGrades =
    doc.grades ?? (doc.grade ? [{ name: "Grade", grade: doc.grade }] : []);
  const baseReference = { book: doc.book, hadith: doc.hadith_in_book ?? doc.number };
  const arabicEntry: HadithEntry | null = showArabic
    ? {
        hadithnumber: doc.number,
        arabicnumber: doc.arabic_number ?? doc.number,
        text: doc.text_ar,
        grades: baseGrades,
        reference: baseReference,
      }
    : null;

  const isPublished = (l: LangCode) =>
    doc.publishedTranslations?.[l] === true;
  const translationSlices: HadithTranslationSlice[] = nonArabic.map((lang) => {
    const rawText = doc.translations?.[lang];
    if (rawText && isPublished(lang)) {
      return {
        requested: lang,
        actual: lang,
        entry: {
          hadithnumber: doc.number,
          arabicnumber: doc.arabic_number ?? doc.number,
          text: rawText,
          grades: baseGrades,
          reference: baseReference,
        },
        fallback: false,
      };
    }
    if (rawText) {
      // Translation exists but is still Draft — never render the unreviewed
      // text and never fall back to English.
      return {
        requested: lang,
        actual: null,
        entry: null,
        fallback: false,
        status: "in_process",
      };
    }
    // No translation in this language. Fall back to English only when
    // English itself is Published.
    const enText = doc.translations?.en;
    if (lang !== "en" && enText && isPublished("en")) {
      return {
        requested: lang,
        actual: "en",
        entry: {
          hadithnumber: doc.number,
          arabicnumber: doc.arabic_number ?? doc.number,
          text: enText,
          grades: baseGrades,
          reference: baseReference,
        },
        fallback: true,
      };
    }
    return {
      requested: lang,
      actual: null,
      entry: null,
      fallback: false,
      status: "in_process",
    };
  });

  const canonical = `${SITE_URL}/${locale}/hadith/${collection}/${number}`;
  const collectionUrl = `${SITE_URL}/${locale}/hadith/${collection}`;
  const bookUrl = `${SITE_URL}/${locale}/hadith/${collection}/book/${doc.book}`;
  const dateModified =
    typeof (doc as { updatedAt?: string }).updatedAt === "string"
      ? (doc as { updatedAt?: string }).updatedAt
      : undefined;

  const prevNumber = adjacent.prev;
  const nextNumber = adjacent.next;
  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";
  const prevHref = prevNumber
    ? `/hadith/${collection}/${prevNumber}${langQS}`
    : null;
  const nextHref = nextNumber
    ? `/hadith/${collection}/${nextNumber}${langQS}`
    : null;

  return (
    <FavoritesProvider
      initialItems={[{ itemType: "hadith", itemIds: Array.from(hadithFavorites) }]}
    >
      <ReadsProvider
        initialReadIds={Array.from(hadithReads)}
        subscribeToLocalStorage={!session}
      >
      <NotesProvider initialItems={[{ itemType: "hadith", notes: hadithNotesRecord }]}>
        {prevHref ? <link rel="prev" href={prevHref} /> : null}
        {nextHref ? <link rel="next" href={nextHref} /> : null}
        <HadithJsonLd
          article={{
            canonicalUrl: canonical,
            locale,
            collectionSlug: collection,
            collectionNameEn: meta.name_en,
            collectionNameAr: meta.name_ar,
            collectionUrl,
            number: doc.number,
            narrator: doc.narrator,
            articleBody: resolved.bodyText,
            articleBodyLanguage: resolved.bodyLanguage,
            textAr: doc.text_ar,
            dateModified,
          }}
          breadcrumbs={{
            homeUrl: `${SITE_URL}/${locale}`,
            homeLabel: t("singleBreadcrumbHome"),
            hadithUrl: `${SITE_URL}/${locale}/hadith`,
            hadithLabel: t("singleBreadcrumbHadith"),
            collectionUrl,
            collectionName: meta.name_en,
            bookUrl,
            bookLabel: `Book ${doc.book}${bookMeta ? `: ${bookMeta.name}` : ""}`,
            hadithNumberLabel: `Hadith ${doc.number}`,
          }}
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
                <nav
                  aria-label="Breadcrumb"
                  className="text-sm text-muted-foreground"
                >
                  <ol className="flex flex-wrap items-center gap-1">
                    <li>
                      <Link href={`/hadith`} className="hover:text-foreground">
                        {t("singleBreadcrumbHadith")}
                      </Link>
                    </li>
                    <li aria-hidden>/</li>
                    <li>
                      <Link
                        href={`/hadith/${collection}`}
                        className="hover:text-foreground"
                      >
                        {localizedCollectionName}
                      </Link>
                    </li>
                    {bookMeta ? (
                      <>
                        <li aria-hidden>/</li>
                        <li>
                          <Link
                            href={`/hadith/${collection}/book/${doc.book}`}
                            className="hover:text-foreground"
                          >
                            {localizedBookName}
                          </Link>
                        </li>
                      </>
                    ) : null}
                    <li aria-hidden>/</li>
                    <li className="text-foreground">#{doc.number}</li>
                  </ol>
                </nav>

                <header className="mt-4 border-b border-border pb-6">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("singleEyebrow", {
                      collection: localizedCollectionName,
                      number: doc.number,
                    })}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {collectionLabel} #{doc.number}
                  </h1>
                  {bookMeta ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("singleReferenceValue", {
                        collection: localizedCollectionName,
                        book: doc.book,
                        hadithInBook: doc.hadith_in_book ?? doc.number,
                      })}
                    </p>
                  ) : null}
                </header>

                <div className="mt-6">
                  <HadithCard
                    number={doc.number}
                    arabic={arabicEntry}
                    translations={translationSlices}
                    collectionShortName={collectionShortName}
                    collectionId={collection}
                    collectionName={localizedCollectionName}
                    bookNumber={doc.book}
                    bookName={localizedBookName}
                    locale={locale}
                    signedIn={Boolean(session)}
                    currentUid={session?.uid ?? null}
                    commentCount={commentCounts.get(`${collection}:${number}`) ?? 0}
                    interactionMode="scroll-to-tab"
                    tabsAnchorId={HADITH_DETAIL_TABS_ANCHOR}
                  />
                </div>

                <HadithDetailTabs
                  initialCommentCount={
                    commentCounts.get(`${collection}:${number}`) ?? 0
                  }
                  commentsSlot={
                    <CommentThread
                      bare
                      entityType="hadith"
                      entityId={`${collection}:${number}`}
                      itemMeta={{
                        title: `${localizedCollectionName} — ${localizedBookName} #${doc.number}`,
                        subtitle: null,
                        href: `/hadith/${collection}/${doc.number}`,
                        locale,
                      }}
                    />
                  }
                  notesSlot={
                    <InlineNoteEditor
                      itemType="hadith"
                      itemId={`${collection}/${doc.book}/${doc.number}`}
                      itemMeta={{
                        title: `${localizedCollectionName} — ${localizedBookName} #${doc.number}`,
                        subtitle: null,
                        href: `/hadith/${collection}/${doc.number}`,
                        arabic: doc.text_ar,
                        locale,
                      }}
                      signedIn={Boolean(session)}
                    />
                  }
                />

                <nav className="mt-8 flex items-center justify-between gap-2 text-sm">
                  {prevHref && prevNumber ? (
                    <Link
                      href={prevHref}
                      className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
                    >
                      {t("prevHadith", { n: prevNumber })}
                    </Link>
                  ) : (
                    <span />
                  )}
                  {bookMeta ? (
                    <Link
                      href={`/hadith/${collection}/book/${doc.book}${langQS}`}
                      className="rounded-md border border-border bg-background px-3 py-2 text-muted-foreground hover:border-accent hover:text-foreground"
                    >
                      {t("singleBackToBook", { bookName: localizedBookName })}
                    </Link>
                  ) : null}
                  {nextHref && nextNumber ? (
                    <Link
                      href={nextHref}
                      className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
                    >
                      {t("nextHadith", { n: nextNumber })}
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
      </ReadsProvider>
    </FavoritesProvider>
  );
}

