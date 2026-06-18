import { computeAdhan, formatTimeInZone } from "@/lib/mosques/adhan";
import { resolveAdhan } from "@/lib/mosques/iqamah";
import type { Mosque } from "@/types/mosque";
import { PrayerCountdownClient, type CountdownPrayer } from "./PrayerCountdownClient";

const DAILY = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

/**
 * Right-rail prayer-times card with a live "next prayer in …" countdown. The
 * five daily instants (+ tomorrow's Fajr for the after-Isha case) are computed
 * server-side from the masjid's location/method; a client child ticks to find
 * the next prayer. Iqamah times come from the manager-set values.
 */
export function PrayerCountdownCard({
  mosque,
  locale,
  layout = "vertical",
}: {
  mosque: Mosque;
  locale: string;
  layout?: "horizontal" | "vertical";
}) {
  const tz = mosque.timezone ?? "UTC";
  const intlLocale = locale === "ar" ? "ar" : locale;
  const now = new Date();
  const today = computeAdhan(mosque, now);
  const tomorrow = computeAdhan(mosque, new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const rows = resolveAdhan(mosque, { locale: intlLocale, date: now, includeJumuah: false });

  const prayers: CountdownPrayer[] = DAILY.map((key) => ({
    key,
    label: formatTimeInZone(today[key], tz, intlLocale),
    epoch: today[key].getTime(),
    iqamah: rows.find((r) => r.prayer === key)?.iqamahLabel ?? null,
  }));
  const hasIqamah = prayers.some((p) => p.iqamah);

  return (
    <div className="mq-card mq-card-pad">
      <PrayerCountdownClient
        prayers={prayers}
        tomorrowFajr={{ label: formatTimeInZone(tomorrow.fajr, tz, intlLocale), epoch: tomorrow.fajr.getTime() }}
        hasIqamah={hasIqamah}
        layout={layout}
      />
    </div>
  );
}
