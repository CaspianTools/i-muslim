import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getHadithCollection } from "@/lib/hadith/db";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { HadithSidebar } from "@/components/site/hadith/HadithSidebar";
import { HadithMobileDrawer } from "@/components/site/hadith/HadithMobileDrawer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collection: string }>;
}): Promise<Metadata> {
  const { collection } = await params;
  const meta = await getHadithCollection(collection);
  if (!meta) return {};
  const t = await getTranslations("hadithPage");
  return {
    title: t("collectionMetaTitle", { name: meta.name_en }),
    description: t("collectionMetaDescription", { name: meta.name_en }),
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
  const [meta, languageSettings, t] = await Promise.all([
    getHadithCollection(collection),
    getLanguageSettings(),
    getTranslations("hadithPage"),
  ]);
  if (!meta) notFound();

  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <div className="flex items-center gap-2 pb-3 md:hidden">
        <HadithMobileDrawer availableLangs={languageSettings.hadithEnabled} />
      </div>
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

          <header className="mt-4 border-b border-border pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {meta.name_en}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("collectionSummary", {
                    books: meta.books.length,
                    total: meta.total,
                  })}
                </p>
              </div>
              <p dir="rtl" lang="ar" className="font-arabic text-3xl text-foreground">
                {meta.name_ar}
              </p>
            </div>
          </header>

          <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-background">
            {meta.books.map((b) => (
              <li key={b.number}>
                <Link
                  href={`/hadith/${collection}/${b.number}${langQS}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                    {b.number}
                  </span>
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("bookCount", { count: b.count })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
