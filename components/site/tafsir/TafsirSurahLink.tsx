import { BookOpenText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countBlocks } from "@/lib/tafsir/blocks";
import type { TafsirLang } from "@/lib/tafsir/works";

/**
 * Crawlable entry point from the Quran reader into the tafsir section. The
 * inline panel is client-fetched and so invisible to crawlers; this link is the
 * server-rendered path in, which is what actually gets the tafsir pages
 * discovered and indexed.
 */
export async function TafsirSurahLink({
  work,
  lang,
  surah,
}: {
  work: string;
  lang: TafsirLang;
  surah: number;
}) {
  const t = await getTranslations("tafsir");
  const count = countBlocks(lang, surah);
  if (count === 0) return null;

  return (
    <Link
      href={`/tafsir/${work}/${lang}/${surah}`}
      className="group flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-accent"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
        <BookOpenText className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{t("surahCta")}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {t("passageCount", { count })}
        </span>
      </span>
    </Link>
  );
}
