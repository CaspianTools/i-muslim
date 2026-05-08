import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSurahs } from "@/lib/quran/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("quranPage");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function QuranIndexPage() {
  const [chapters, t] = await Promise.all([
    getSurahs(),
    getTranslations("quranPage"),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("indexHeading")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("indexSubtitle")}
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((c) => (
          <li key={c.id}>
            <Link
              href={`/quran/${c.id}`}
              className="group flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                {c.id}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{c.name_simple}</span>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-lg leading-none text-foreground"
                  >
                    {c.name_arabic}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t("cardSummary", {
                    translatedName: c.translated_name.name,
                    verses: t("verseCount", { count: c.verses_count }),
                    revelation:
                      c.revelation_place === "makkah"
                        ? t("revelationMakkan")
                        : t("revelationMadinan"),
                  })}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
