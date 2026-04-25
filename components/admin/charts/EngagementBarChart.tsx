"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ kind: string; value: number }>;
}

export function EngagementBarChart({ data }: Props) {
  const t = useTranslations("dashboard.engagement");
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="pb-4">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis
              type="category"
              dataKey="kind"
              tickLine={false}
              axisLine={false}
              stroke="var(--color-muted-foreground)"
              fontSize={11}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--color-popover-foreground)",
              }}
              cursor={{ fill: "var(--color-muted)" }}
            />
            <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
