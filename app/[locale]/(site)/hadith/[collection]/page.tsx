import Link from "next/link";
import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getHadithCollection } from "@/lib/hadith/db";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { HadithSidebar } from "@/components/site/hadith/HadithSidebar";
import { HadithFiltersButton } from "@/components/site/hadith/HadithFiltersButton";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { FavoritesProvider } from "@/components/site/favorites/FavoritesContext";
import { NotesProvider } from "@/components/site/notes/NotesContext";
import { getSiteSession } from "@/lib/auth/session";
import { getFavoritedSet } from "@/lib/profile/data";
import {
  getFavoriteCountsForBooks,
  getFavoriteStats,
} from "@/lib/profile/favoriteStats";
import { getNotesByItemType } from "@/lib/profile/notes-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string }>;
}): Promise<Metadata> {
  const { collection } = await params;
  const meta = await getHadithCollection(collection);
  if (!meta) return {};
  const [t, tCollections] = await Promise.all([
    getTranslations("hadithPage"),
    getTranslations("hadithCollectionNames"),
  ]);
  const name = tCollections.has(collection) ? tCollections(collection) : meta.name_en;
  return {
    title: t("collectionMetaTitle", { name }),
    description: t("collectionMetaDescription", { name }),
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ collection: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { collection } = await params;
  const { lang: langParam } = await searchParams;
  const session = await getSiteSession();
  const locale = await getLocale();

  const [meta, languageSettings, t, tCollections, tBookNames, collectionFavorites] =
    await Promise.all([
      getHadithCollection(collection),
      getLanguageSettings(),
      getTranslations("hadithPage"),
      getTranslations("hadithCollectionNames"),
      getTranslations("hadithBookNames"),
      session
        ? getFavoritedSet(session.uid, "hadithCollection")
        : Promise.resolve(new Set<string>()),
    ]);
  if (!meta) notFound();

  const collectionNotes = session
    ? await getNotesByItemType(session.uid, "hadithCollection")
    : new Map<string, { id: string; text: string; updatedAt: string }>();
  const collectionNotesRecord: Record<
    string,
    { id: string; text: string; updatedAt: string }
  > = {};
  for (const [k, v] of collectionNotes) collectionNotesRecord[k] = v;

  const bookKeys = meta.books.map((b) => `${collection}:${b.number}`);
  const [collectionFavoriteStats, bookFavoriteCounts] = await Promise.all([
    getFavoriteStats("hadithCollection", collection),
    getFavoriteCountsForBooks(bookKeys),
  ]);

  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";
  const localizedCollectionName = tCollections.has(collection)
    ? tCollections(collection)
    : meta.name_en;
  const localizedBookName = (n: number, fallback: string): string => {
    const key = `${collection}.${n}` as const;
    return tBookNames.has(key) ? tBookNames(key) : fallback;
  };

  return (
    <FavoritesProvider
      initialItems={[
        { itemType: "hadithCollection", itemIds: Array.from(collectionFavorites) },
      ]}
    >
      <NotesProvider
        initialItems={[{ itemType: "hadithCollection", notes: collectionNotesRecord }]}
      >
        <div className="mx-auto max-w-6xl px-4 py-4 sm:py-10">
          <div className="flex gap-6">
            <aside className="hidden md:block sticky top-20 self-start">
              <HadithSidebar variant="desktop" availableLangs={languageSettings.hadithEnabled} />
            </aside>
            <div className="min-w-0 flex-1">
              <Link
                href={`/hadith${langQS}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("backToCollections")}
              </Link>

              <header className="mt-3 border-b border-border pb-4 sm:mt-4 sm:pb-6">
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      {localizedCollectionName}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("collectionSummary", {
                        books: meta.books.length,
                        total: meta.total,
                      })}
                    </p>
                  </div>
                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-2xl text-foreground sm:text-3xl"
                  >
                    {meta.name_ar}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2 sm:mt-4">
                  <FavoriteButton
                    itemType="hadithCollection"
                    itemId={collection}
                    itemMeta={{
                      title: localizedCollectionName,
                      subtitle: meta.short_name ?? meta.name_en,
                      href: `/hadith/${collection}`,
                      arabic: meta.name_ar,
                      locale,
                    }}
                    signedIn={Boolean(session)}
                    size="md"
                    count={collectionFavoriteStats.count}
                  />
                  <HadithFiltersButton availableLangs={languageSettings.hadithEnabled} />
                </div>
              </header>

              <ul className="mt-4 sm:mt-6 divide-y divide-border rounded-lg border border-border bg-background">
                {meta.books.map((b) => {
                  const key = `${collection}:${b.number}`;
                  const favCount = bookFavoriteCounts.get(key) ?? 0;
                  return (
                    <li key={b.number}>
                      <Link
                        href={`/hadith/${collection}/book/${b.number}${langQS}`}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                          {b.number}
                        </span>
                        <span className="flex-1 truncate">
                          {localizedBookName(b.number, b.name)}
                        </span>
                        {favCount > 0 && (
                          <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Heart className="size-3.5" />
                            <span className="tabular-nums">{favCount}</span>
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {t("bookCount", { count: b.count })}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </NotesProvider>
    </FavoritesProvider>
  );
}
