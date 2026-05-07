import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

interface Props {
  current: number;
  total: number;
  prev?: { id: number; name_simple: string } | null;
  next?: { id: number; name_simple: string } | null;
  /** Existing `?lang=…` query suffix to preserve when navigating. */
  qs?: string;
}

/**
 * End-of-surah pagination. Replaces the bare "Next surah →" line with a
 * three-slot row: previous surah on the start edge, current/total + progress
 * bar in the centre, next surah on the end edge. The progress bar gives the
 * reader a sense of where they are in the 114-surah corpus — "where am I"
 * is the question that pops at chapter boundaries.
 */
export async function SurahPagination({
  current,
  total,
  prev,
  next,
  qs = "",
}: Props) {
  const t = await getTranslations("surahPagination");
  const percent = Math.round((current / total) * 100);

  return (
    <nav
      aria-label={t("ariaLabel")}
      className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm"
    >
      {prev ? (
        <Link
          href={`/quran/${prev.id}${qs}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 hover:border-accent justify-self-start min-w-0"
          rel="prev"
        >
          <ArrowLeft className="size-3.5 shrink-0 rtl:rotate-180" />
          <span className="truncate">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("previous")}
            </span>
            <span className="block">{prev.name_simple}</span>
          </span>
        </Link>
      ) : (
        <span aria-hidden />
      )}

      <div className="flex flex-col items-center gap-1.5 px-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("position", { current, total })}
        </span>
        <div
          className="h-1 w-24 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={t("progressLabel")}
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {next ? (
        <Link
          href={`/quran/${next.id}${qs}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 hover:border-accent justify-self-end min-w-0"
          rel="next"
        >
          <span className="truncate text-end">
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("next")}
            </span>
            <span className="block">{next.name_simple}</span>
          </span>
          <ArrowRight className="size-3.5 shrink-0 rtl:rotate-180" />
        </Link>
      ) : (
        <span aria-hidden />
      )}
    </nav>
  );
}
