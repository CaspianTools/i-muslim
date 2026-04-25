import Link from "next/link";
import { Suspense } from "react";
import { searchQuran } from "@/lib/quran";
import { COLLECTIONS, getEditionsForLangs } from "@/lib/hadith";
import { parseLangsParam, LANG_LABELS } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import type { HadithEntry } from "@/types/hadith";

export const metadata = {
  title: "Search",
  description: "Search the Quran and major Hadith collections.",
};

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string }>;
}) {
  const { q: qRaw, lang: langParam } = await searchParams;
  const q = (qRaw ?? "").trim();
  const langs = parseLangsParam(langParam);

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Search</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Type a query in the search bar to find verses and hadith.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">
        Results for &ldquo;{q}&rdquo;
      </h1>
      <div className="mt-8 space-y-10">
        <Suspense fallback={<SectionSkeleton title="Quran" />}>
          <QuranResults q={q} langs={langs} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton title="Hadith" />}>
          <HadithResults q={q} langs={langs} />
        </Suspense>
      </div>
    </div>
  );
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">Searching…</p>
    </section>
  );
}

async function QuranResults({ q, langs }: { q: string; langs: LangCode[] }) {
  let results;
  try {
    results = await searchQuran(q, langs);
  } catch {
    return (
      <section>
        <h2 className="text-lg font-semibold">Quran</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Search temporarily unavailable.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">
        Quran <span className="text-muted-foreground">({results.length})</span>
      </h2>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No matches.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {results.slice(0, 15).map((r) => {
            const [surah] = r.verse_key.split(":");
            const firstTranslation = r.translations?.[0];
            return (
              <li key={r.verse_key}>
                <Link
                  href={`/quran/${surah}#verse-${r.verse_key}`}
                  className="block rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {r.verse_key}
                    </span>
                  </div>
                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-lg leading-loose"
                  >
                    {stripHtml(r.text)}
                  </p>
                  {firstTranslation && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {stripHtml(firstTranslation.text)}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type HadithMatch = {
  collectionSlug: string;
  collectionName: string;
  entry: HadithEntry;
  matchLang: LangCode;
};

async function HadithResults({ q, langs }: { q: string; langs: LangCode[] }) {
  const needle = q.toLowerCase();

  // Search the English edition for every collection (English has full coverage
  // and shared hadithnumber with other editions). If the user has Russian
  // selected, also search Russian editions. Arabic search is limited.
  const searchLangs: LangCode[] = ["en"];
  if (langs.includes("ru")) searchLangs.push("ru");

  const perCollection = await Promise.all(
    COLLECTIONS.map(async (c) => {
      const editions = await getEditionsForLangs(c.slug, searchLangs);
      const matches: HadithMatch[] = [];
      const seen = new Set<number>();
      for (const lang of searchLangs) {
        const info = editions.get(lang);
        if (!info || info.fallback) continue;
        for (const h of info.edition.hadiths) {
          if (matches.length >= 8) break;
          if (seen.has(h.hadithnumber)) continue;
          if (h.text.toLowerCase().includes(needle)) {
            seen.add(h.hadithnumber);
            matches.push({
              collectionSlug: c.slug,
              collectionName: c.shortName ?? c.name,
              entry: h,
              matchLang: lang,
            });
          }
        }
        if (matches.length >= 8) break;
      }
      return matches;
    }),
  );

  const allMatches = perCollection.flat();

  return (
    <section>
      <h2 className="text-lg font-semibold">
        Hadith{" "}
        <span className="text-muted-foreground">
          ({allMatches.length}
          {allMatches.length >= COLLECTIONS.length * 8 ? "+" : ""})
        </span>
      </h2>
      {allMatches.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No matches in searched collections.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {allMatches.map((m) => (
            <li key={`${m.collectionSlug}-${m.entry.hadithnumber}-${m.matchLang}`}>
              <Link
                href={`/hadith/${m.collectionSlug}/${m.entry.reference.book}`}
                className="block rounded-lg border border-border bg-background p-4 transition-colors hover:border-accent"
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {m.collectionName} #{m.entry.hadithnumber}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {LANG_LABELS[m.matchLang]}
                  </span>
                </div>
                <p className="line-clamp-3 text-sm leading-relaxed">
                  {m.entry.text}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
