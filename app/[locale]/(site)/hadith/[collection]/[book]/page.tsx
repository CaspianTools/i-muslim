import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getHadithCollection,
  getHadithsByBook,
  type HadithDoc,
} from "@/lib/hadith/db";
import { parseLangsParam } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import { LanguageSelector } from "@/components/LanguageSelector";
import { HadithCard, type HadithTranslationSlice } from "@/components/HadithCard";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
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

  const [hadiths, languageSettings] = await Promise.all([
    getHadithsByBook(collection, bookNumber),
    getLanguageSettings(),
  ]);

  const prev = meta.books.find((b) => b.number === bookNumber - 1);
  const next = meta.books.find((b) => b.number === bookNumber + 1);
  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
          <Suspense fallback={<div className="h-8" />}>
            <LanguageSelector availableLangs={languageSettings.contentEnabled} />
          </Suspense>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        {hadiths.map((h) => {
          const arabic = showArabic ? docToHadithEntry(h, "ar") : null;
          const translations: HadithTranslationSlice[] = nonArabic.map((lang) => {
            // Prefer the doc's translation in the requested language. If it's
            // missing or empty (e.g. seed hasn't been run for this lang yet),
            // fall back to English so the reader sees something.
            const native = docToHadithEntry(h, lang);
            if (native) {
              return { requested: lang, actual: lang, entry: native, fallback: false };
            }
            const enEntry = lang !== "en" ? docToHadithEntry(h, "en") : null;
            return {
              requested: lang,
              actual: enEntry ? "en" : null,
              entry: enEntry,
              fallback: Boolean(enEntry),
            };
          });
          return (
            <HadithCard
              key={h.number}
              number={h.number}
              arabic={arabic}
              translations={translations}
              collectionShortName={meta.short_name ?? meta.name_en}
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
  );
}
