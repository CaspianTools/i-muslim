"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  formatCountdown,
  formatPrayerTime,
  type PrayerKey,
} from "@/lib/prayer/engine";
import { usePrayerTimes } from "@/lib/prayer/use-prayer-times";

const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export function PrayerTimesBar() {
  const t = useTranslations("prayerBar");
  const tPrayers = useTranslations("prayerTimes");
  const locale = useLocale();
  const { effectivePrefs, today, next } = usePrayerTimes();

  const tz = effectivePrefs?.tz ?? "UTC";
  const city = effectivePrefs?.city ?? null;
  const cc = effectivePrefs?.countryCode ?? null;
  const locationLabel = city
    ? cc
      ? `${city}, ${cc}`
      : city
    : t("viewAll");

  return (
    <div className="border-b border-border bg-muted/40 text-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 overflow-x-auto whitespace-nowrap">
        <ul className="flex flex-1 items-center gap-1 text-xs sm:text-sm">
          {PRAYERS.map((key) => {
            const isNext = next?.key === key && !next.isTomorrow;
            const time = today ? formatPrayerTime(today[key], tz, locale) : "—";
            const label = tPrayers(key);
            return (
              <li key={key}>
                <Link
                  href="/prayer-times"
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors " +
                    (isNext
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground")
                  }
                  aria-current={isNext ? "true" : undefined}
                >
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
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/prayer-times"
          className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-xs sm:text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("viewAllAria")}
        >
          <span className="truncate max-w-[10rem]">{locationLabel}</span>
          <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
