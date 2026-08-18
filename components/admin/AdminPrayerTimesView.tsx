"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { MonthlyTable } from "@/components/prayer/MonthlyTable";
import { PrayerTimesSettings } from "@/components/prayer/PrayerTimesSettings";
import { MECCA_FALLBACK } from "@/lib/prayer/location";
import {
  pickDefaultMadhab,
  pickDefaultMethod,
} from "@/lib/prayer/methods";
import {
  usePrayerPrefs,
  type PrayerPrefs,
} from "@/lib/prayer/storage";

function buildFallbackPrefs(): PrayerPrefs {
  return {
    version: 1,
    method: pickDefaultMethod(MECCA_FALLBACK.countryCode),
    madhab: pickDefaultMadhab(MECCA_FALLBACK.countryCode),
    coords: MECCA_FALLBACK.coords,
    city: MECCA_FALLBACK.city,
    countryCode: MECCA_FALLBACK.countryCode,
    tz: MECCA_FALLBACK.tz,
    source: "fallback",
    updatedAt: new Date().toISOString(),
  };
}

export function AdminPrayerTimesView() {
  const tPrayer = useTranslations("prayer");
  const stored = usePrayerPrefs();
  const prefs = stored ?? buildFallbackPrefs();

  const icsHref = `/prayer-times/calendar.ics?${new URLSearchParams({
    lat: String(prefs.coords.lat),
    lng: String(prefs.coords.lng),
    method: prefs.method,
    madhab: prefs.madhab,
    tz: prefs.tz,
    days: "30",
    ...(prefs.city ? { city: prefs.city } : {}),
  }).toString()}`;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">
              {prefs.city ?? `${prefs.coords.lat.toFixed(3)}, ${prefs.coords.lng.toFixed(3)}`}
              {prefs.countryCode ? ` · ${prefs.countryCode}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {prefs.method} ·{" "}
              {prefs.madhab === "hanafi"
                ? tPrayer("settings.madhabHanafi")
                : tPrayer("settings.madhabStandardShort")}{" "}
              · {prefs.tz}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={icsHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Download className="size-4" />
              {tPrayer("exportIcs")}
            </a>
            <PrayerTimesSettings current={prefs} />
          </div>
        </div>
      </section>

      <section>
        <header className="mb-3">
          <h2 className="text-base font-semibold">{tPrayer("monthlyTitle")}</h2>
          <p className="text-xs text-muted-foreground">{tPrayer("monthlySubtitle")}</p>
        </header>
        <MonthlyTable
          coords={prefs.coords}
          method={prefs.method}
          madhab={prefs.madhab}
          tz={prefs.tz}
          days={30}
        />
      </section>
    </div>
  );
}
