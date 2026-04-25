"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/admin/StatCard";
import type { MatrimonialStats } from "@/types/matrimonial";

export function StatsTab({ stats }: { stats: MatrimonialStats }) {
  const t = useTranslations("matrimonial.admin");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("kpi.active")} value={stats.activeProfiles} />
        <StatCard label={t("kpi.pending")} value={stats.pendingProfiles} />
        <StatCard label={t("kpi.matchesWeek")} value={stats.matchesThisWeek} />
        <StatCard label={t("kpi.openReports")} value={stats.openReports} />
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">{t("growth.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("growth.subtitle")}</p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.growth30d}>
              <defs>
                <linearGradient id="profileGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="profiles"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                fill="url(#profileGrowth)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
