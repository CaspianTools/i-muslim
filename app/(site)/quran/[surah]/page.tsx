import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSurah,
  getSurahs,
  getAyahsForSurah,
  filterVerseLangs,
} from "@/lib/quran/db";
import { parseLangsParam } from "@/lib/translations";
import { Suspense } from "react";
import { AyahCard } from "@/components/AyahCard";
import { LanguageSelector } from "@/components/LanguageSelector";

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
  const [chapter, allVerses, chapters] = await Promise.all([
    getSurah(id),
    getAyahsForSurah(id),
    getSurahs(),
  ]);
  if (!chapter) notFound();
  const verses = allVerses.map((v) => filterVerseLangs(v, langs));

  const prev = chapters.find((c) => c.id === id - 1);
  const next = chapters.find((c) => c.id === id + 1);
  const langQS = langParam ? `?lang=${encodeURIComponent(langParam)}` : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
        <div className="mt-4">
          <Suspense fallback={<div className="h-8" />}>
            <LanguageSelector />
          </Suspense>
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
          <AyahCard key={v.id} verse={v} langs={langs} />
        ))}
      </div>

      <nav className="mt-8 flex items-center justify-between gap-2 text-sm">
        {prev ? (
          <Link
            href={`/quran/${prev.id}${langQS}`}
            className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
          >
            ← {prev.name_simple}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/quran/${next.id}${langQS}`}
            className="rounded-md border border-border bg-background px-3 py-2 hover:border-accent"
          >
            {next.name_simple} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
