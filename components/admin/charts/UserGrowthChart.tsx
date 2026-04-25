"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type Range = "30" | "90" | "365";

type RangeKey = Range;

type SeriesPoint = { date: string; users: number };

interface Props {
  data: Record<RangeKey, SeriesPoint[]>;
}

export function UserGrowthChart({ data }: Props) {
  const [range, setRange] = useState<Range>("30");
  const series = useMemo(() => data[range] ?? [], [data, range]);
  const t = useTranslations("dashboard.userGrowth");
  const locale = useLocale();

  const RANGES: Array<{ value: Range; labelKey: "range30" | "range90" | "range365" }> = [
    { value: "30", labelKey: "range30" },
    { value: "90", labelKey: "range90" },
    { value: "365", labelKey: "range365" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div
          role="tablist"
          className="inline-flex rounded-md border border-border p-0.5 text-xs"
        >
          {RANGES.map((r) => (
            <button
              key={r.value}
              role="tab"
              type="button"
              aria-selected={range === r.value}
              className={cn(
                "rounded-sm px-2.5 py-1 font-medium transition-colors",
                range === r.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setRange(r.value)}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="user-growth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
              }}
              minTickGap={30}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--color-popover-foreground)",
              }}
              labelStyle={{ color: "var(--color-muted-foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="url(#user-growth-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
