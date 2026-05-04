"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  formatCountdown,
  formatPrayerTime,
  type PrayerKey,
} from "@/lib/prayer/engine";
import { usePrayerTimes } from "@/lib/prayer/use-prayer-times";

const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

interface PrayerPillsProps {
  className?: string;
  interactive?: boolean;
}

export function PrayerPills({
  className,
  interactive = true,
}: PrayerPillsProps) {
  const t = useTranslations("prayerBar");
  const tPrayers = useTranslations("prayerTimes");
  const locale = useLocale();
  const { effectivePrefs, today, next } = usePrayerTimes();

  const tz = effectivePrefs?.tz ?? "UTC";

  return (
    <ul
      className={
        "flex items-center gap-1 text-xs sm:text-sm " + (className ?? "")
      }
    >
      {PRAYERS.map((key) => {
        const isNext = next?.key === key && !next.isTomorrow;
        const time = today ? formatPrayerTime(today[key], tz, locale) : "—";
        const label = tPrayers(key);
        const baseClass =
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 " +
          (isNext ? "ui-selected font-medium" : "text-muted-foreground");
        const interactiveClass = interactive
          ? " transition-colors" +
            (isNext ? "" : " hover:bg-muted hover:text-foreground")
          : "";
        const pillClass = baseClass + interactiveClass;
        const inner = (
          <>
            <span>{label}</span>
            <span className="font-mono tabular-nums hidden sm:inline">
              {time}
            </span>
            {isNext && next && (
              <span className="font-mono tabular-nums text-primary/80">
                <span className="hidden sm:inline">·</span>{" "}
                {t("inCountdown", {
                  countdown: formatCountdown(next.minutesUntil),
                })}
              </span>
            )}
          </>
        );
        return (
          <li key={key}>
            {interactive ? (
              <Link
                href="/prayer-times"
                className={pillClass}
                aria-current={isNext ? "true" : undefined}
              >
                {inner}
              </Link>
            ) : (
              <span className={pillClass} aria-current={isNext ? "true" : undefined}>
                {inner}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
