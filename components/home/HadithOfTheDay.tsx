import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ScrollText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getHadithOfTheDay } from "@/lib/hadith/of-the-day";

export async function HadithOfTheDay() {
  const [t, tCollections, locale] = await Promise.all([
    getTranslations("home.hadithOfDay"),
    getTranslations("hadithCollectionNames"),
    getLocale(),
  ]);
  const hadith = await getHadithOfTheDay(new Date(), locale);
  if (!hadith) return null;
  const collectionName = tCollections.has(hadith.collection)
    ? tCollections(hadith.collection)
    : hadith.collectionName;
  const reference = `${collectionName} · #${hadith.number}`;
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-accent">
      <header className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
        <ScrollText className="size-3.5" />
        <span>{t("heading")}</span>
      </header>
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic mt-5 text-xl leading-loose text-foreground sm:text-2xl"
      >
        {hadith.arabic}
      </p>
      {hadith.translation && (
        <p
          lang={hadith.translationLang ?? "en"}
          className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base line-clamp-6"
        >
          {hadith.translation}
        </p>
      )}
      <footer className="mt-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{reference}</span>
          {hadith.grade && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide">
              {hadith.grade}
            </span>
          )}
        </div>
        <Link
          href={`/hadith/${hadith.collection}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t("openCollection")}
          <ArrowRight className="size-3 rtl:rotate-180" />
        </Link>
      </footer>
    </article>
  );
}
