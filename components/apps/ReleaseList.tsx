import { ChevronDown } from "lucide-react";
import type { AppRelease } from "@/lib/apps/quran";

/**
 * The release history, as a list of expandable rows. Shared by /apps/quran
 * (latest few) and /apps/quran/changelog (all of them).
 *
 * Server component built on native `<details>`: no client bundle, no
 * hydration, and it still works with JavaScript off.
 */
export function ReleaseList({
  releases,
  locale,
  noNoteLabel,
}: {
  releases: readonly AppRelease[];
  locale: string;
  /** Fallback for the handful of early releases with no recorded note. */
  noNoteLabel: string;
}) {
  // Date-only strings, so the timezone must be pinned: parsing "2026-07-31"
  // and formatting in the server's local zone renders 30 July west of UTC.
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  });

  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {releases.map((release, i) => (
        <li key={release.versionCode}>
          <details className="group" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-baseline gap-3 p-4 hover:bg-muted/40 sm:p-5 [&::-webkit-details-marker]:hidden">
              {/* Pinned LTR so "1.0.42" doesn't reorder beside Arabic text. */}
              <span
                dir="ltr"
                className="font-mono text-sm font-semibold text-foreground"
              >
                {release.version}
              </span>
              {/* <bdi> so the English summary can't have its edges reordered
                  by the surrounding Arabic, while still flowing in the row. */}
              <bdi className="min-w-0 flex-1 text-sm text-foreground/90">
                {release.summary}
              </bdi>
              {release.date && (
                <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
                  {format.format(new Date(`${release.date}T00:00:00Z`))}
                </span>
              )}
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              />
            </summary>
            {/* The notes are English. Without an explicit base direction they
                inherit RTL on /ar, which throws the closing full stop to the
                left and reorders every dash and parenthesis. */}
            <p
              lang="en"
              dir="ltr"
              className="px-4 pb-4 text-sm leading-relaxed text-foreground/80 sm:px-5 sm:pb-5"
            >
              {release.note ?? noNoteLabel}
            </p>
          </details>
        </li>
      ))}
    </ol>
  );
}
