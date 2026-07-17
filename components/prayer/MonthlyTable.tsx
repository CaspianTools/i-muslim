"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  computeDailyTimes,
  formatPrayerTime,
  type Coords,
  type MadhabKey,
  type MethodKey,
  type PrayerOrSunrise,
} from "@/lib/prayer/engine";

interface Props {
  coords: Coords;
  method: MethodKey;
  madhab: MadhabKey;
  tz: string;
  startDate?: Date;
  days?: number;
}

const COLUMNS: PrayerOrSunrise[] = [
  "fajr",
  "sunrise",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

export function MonthlyTable({
  coords,
  method,
  madhab,
  tz,
  startDate,
  days = 30,
}: Props) {
  const t = useTranslations("prayerTimes");
  const locale = useLocale();

  const startKey = (startDate ?? new Date()).toDateString();
  const rows = useMemo(() => {
    const start = startDate ?? new Date();
    const out: { date: Date; times: ReturnType<typeof computeDailyTimes> }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push({
        date: d,
        times: computeDailyTimes({
          date: d,
          coords,
          method,
          madhab,
          tz,
        }),
      });
    }
    return out;
    // startKey covers startDate; coords broken down by lat/lng intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.lat, coords.lng, method, madhab, tz, startKey, days]);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t("date")}</th>
            {COLUMNS.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {t(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.date.toISOString()} className="hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">
                {dateFormatter.format(r.date)}
              </td>
              {COLUMNS.map((c) => (
                <td key={c} className="px-3 py-2 font-mono tabular-nums">
                  {formatPrayerTime(r.times[c], tz, locale)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
