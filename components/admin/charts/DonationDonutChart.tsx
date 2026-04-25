"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface Props {
  data: Array<{ category: string; value: number }>;
}

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
];

export function DonationDonutChart({ data }: Props) {
  const t = useTranslations("dashboard.donations");
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="pb-4">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-6">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--color-card)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--color-popover-foreground)",
                }}
                formatter={(v) => [`$${Number(v).toLocaleString()}`, undefined]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-2 text-sm">
          {data.map((d, i) => {
            const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
            return (
              <li key={d.category} className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                  aria-hidden
                />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{d.category}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ${d.value.toLocaleString()} · {pct}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
