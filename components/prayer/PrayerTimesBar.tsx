"use client";

import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PrayerPills } from "./PrayerPills";
import { NextPrayerPill } from "./NextPrayerPill";
import { usePrayerTimes } from "@/lib/prayer/use-prayer-times";

export function PrayerTimesBar() {
  const t = useTranslations("prayerBar");
  const { effectivePrefs, today } = usePrayerTimes();

  const city = effectivePrefs?.city ?? null;
  const cc = effectivePrefs?.countryCode ?? null;
  const locationLabel = city
    ? cc
      ? `${city}, ${cc}`
      : city
    : t("viewAll");

  return (
    <div data-reading-chrome className="border-b border-border bg-muted/40 text-foreground">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5">
        {/* Mobile: a single tappable next-prayer pill linking to the full table.
            Replaces the desktop 5-prayer row that overflowed at 390px. */}
        <Link
          href="/prayer-times"
          className="md:hidden inline-flex items-center gap-1.5 rounded-md px-1 py-0.5"
          aria-label={t("viewAllAria")}
        >
          {today ? (
            <NextPrayerPill today={today} />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </Link>

        {/* Desktop: full prayer row + location label. */}
        <PrayerPills className="hidden md:flex flex-1" />
        <Link
          href="/prayer-times"
          className="ml-auto hidden md:inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-xs sm:text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("viewAllAria")}
        >
          <span className="truncate max-w-[10rem]">{locationLabel}</span>
          <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
