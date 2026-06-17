"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export interface CountdownPrayer {
  key: string;
  label: string;
  epoch: number;
  iqamah: string | null;
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function PrayerCountdownClient({
  prayers,
  tomorrowFajr,
  hasIqamah,
}: {
  prayers: CountdownPrayer[];
  tomorrowFajr: { label: string; epoch: number };
  hasIqamah: boolean;
}) {
  const t = useTranslations("mosques.community");
  const tp = useTranslations("mosques.prayer");
  // `null` until mounted so SSR and first client render agree (no hydration
  // mismatch); the first real value lands on the next tick after mount.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const sequence = [...prayers, { key: "fajr", label: tomorrowFajr.label, epoch: tomorrowFajr.epoch, iqamah: null }];
  const next = now == null ? null : sequence.find((p) => p.epoch > now) ?? null;

  return (
    <div>
      <div className="mq-rail-title">{t("prayerHeading")}</div>

      {next && now != null && (
        <div className="mb-3 grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl bg-accent px-4 py-3 text-accent-foreground">
          <div>
            <div className="text-[0.7rem] font-medium uppercase tracking-wider opacity-80 sm:text-[0.65rem]">
              {t("nextPrayer")}
            </div>
            <div className="font-display text-xl leading-none">{tp(next.key)}</div>
          </div>
          <div className="text-end">
            <div className="font-display text-lg leading-none">{fmtCountdown(next.epoch - now)}</div>
          </div>
        </div>
      )}

      <ul className="space-y-0.5">
        {prayers.map((p) => {
          const isNext = next != null && next.epoch === p.epoch;
          const passed = now != null && p.epoch <= now;
          return (
            <li
              key={p.key}
              className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-2 text-sm sm:gap-3 sm:py-1.5 ${
                isNext ? "bg-selected font-semibold text-accent" : passed ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              <span className="font-display text-[0.95rem]">{tp(p.key)}</span>
              <span className="tabular-nums">{p.label}</span>
              {hasIqamah && (
                <span className={`tabular-nums ${isNext ? "" : "text-accent"}`}>{p.iqamah ?? "—"}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
