"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  sparkline?: number[];
  suffix?: string;
}

export function StatCard({ label, value, delta, sparkline, suffix }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  const chartData = (sparkline ?? []).map((v, i) => ({ i, v }));

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums",
              positive
                ? "bg-success/10 text-success dark:text-success-foreground"
                : "bg-danger/10 text-danger dark:text-danger-foreground",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {displayValue}
          {suffix && <span className="ml-0.5 text-lg font-medium text-muted-foreground">{suffix}</span>}
        </div>
        {chartData.length > 0 && (
          <div className="h-10 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={positive ? "var(--color-success)" : "var(--color-danger)"}
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="100%"
                      stopColor={positive ? "var(--color-success)" : "var(--color-danger)"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={positive ? "var(--color-success)" : "var(--color-danger)"}
                  strokeWidth={1.5}
                  fill={`url(#spark-${label})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
