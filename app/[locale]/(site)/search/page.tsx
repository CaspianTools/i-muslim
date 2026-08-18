import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { searchQuran } from "@/lib/quran";
import { COLLECTIONS, getEditionsForLangs } from "@/lib/hadith";
import { parseLangsParam, QURAN_TRANSLATION_IDS } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import type { HadithEntry } from "@/types/hadith";
import { stripHtml, cleanQuranTranslation } from "@/lib/text/html";

export async function generateMetadata() {
  const t = await getTranslations("searchPage");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lang?: string }>;
}) {
  const { q: qRaw, lang: langParam } = await searchParams;
  const q = (qRaw ?? "").trim();
  const langs = parseLangsParam(langParam);
  const t = await getTranslations("searchPage");
  const tNav = await getTranslations("nav");

  if (!q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">{t("metaTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">
        {t("resultsHeading", { query: q })}
      </h1>
      <div className="mt-8 space-y-10">
        <Suspense
          fallback={
            <SectionSkeleton title={tNav("quran")} label={t("searching")} />
          }
        >
          <QuranResults q={q} langs={langs} />
        </Suspense>
        <Suspense
          fallback={
            <SectionSkeleton title={tNav("hadith")} label={t("searching")} />
          }
        >
          <HadithResults q={q} langs={langs} />
        </Suspense>
      </div>
    </div>
  );
}

function SectionSkeleton({ title, label }: { title: string; label: string }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{label}</p>
    </section>
  );
}

async function QuranResults({ q, langs }: { q: string; langs: LangCode[] }) {
  const t = await getTranslations("searchPage");
  const tNav = await getTranslations("nav");
  let results;
  try {
    results = await searchQuran(q, langs);
  } catch {
    return (
      <section>
        <h2 className="text-lg font-semibold">{tNav("quran")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("unavailable")}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">
        {tNav("quran")}{" "}
        <span className="text-muted-foreground">({results.length})</span>
      </h2>
      {results.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("noMatches")}</p>
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
                      {cleanQuranTranslation(
                        firstTranslation.text,
                        firstTranslation.resource_id === QURAN_TRANSLATION_IDS.en
                          ? "en"
                          : "",
                      )}
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
  const t = await getTranslations("searchPage");
  const tNav = await getTranslations("nav");
  const tLang = await getTranslations("searchPage.matchLang");
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
        {tNav("hadith")}{" "}
        <span className="text-muted-foreground">
          ({allMatches.length}
          {allMatches.length >= COLLECTIONS.length * 8 ? "+" : ""})
        </span>
      </h2>
      {allMatches.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("noMatchesHadith")}
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
                    {tLang(m.matchLang)}
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
