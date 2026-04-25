"use client";

import { Info, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/zakat/calculate";
import type { Totals, UserSettings } from "@/lib/zakat/types";

interface Props {
  totals: Totals;
  nisab: number;
  settings: UserSettings;
  resolveLabel: (label: string) => string;
  onReset: () => void;
}

export function ResultsPanel({
  totals,
  nisab,
  settings,
  resolveLabel,
  onReset,
}: Props) {
  const t = useTranslations("zakat");
  const belowNisab = totals.netWealth < nisab;

  return (
    <aside className="lg:sticky lg:top-20 self-start">
      <div className="rounded-2xl bg-primary text-primary-foreground p-6 sm:p-8 shadow-lg flex flex-col gap-6 min-h-[500px]">
        <div>
          <h2 className="text-xl font-semibold mb-6">{t("results.title")}</h2>

          <div className="space-y-4">
            <div className="border-b border-primary-foreground/15 pb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm opacity-80">
                  {t("results.totalAssets")}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatUSD(totals.positiveAssets)}
                </span>
              </div>
              <div className="space-y-1.5 pl-3 border-l border-primary-foreground/15">
                {totals.breakdown
                  .filter((b) => b.value > 0)
                  .map((item) => (
                    <Row
                      key={item.id}
                      label={t(item.titleKey)}
                      value={item.value}
                    />
                  ))}
                {totals.preciousTotal > 0 && (
                  <Row
                    label={t("breakdown.precious")}
                    value={totals.preciousTotal}
                  />
                )}
              </div>
            </div>

            <div className="border-b border-primary-foreground/15 pb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm opacity-80">
                  {t("results.totalLiabilities")}
                </span>
                <span className="font-semibold tabular-nums text-success-foreground">
                  -{formatUSD(totals.totalLiabilities)}
                </span>
              </div>
              {totals.liabilityItems.length > 0 && (
                <div className="space-y-1.5 pl-3 border-l border-primary-foreground/15">
                  {totals.liabilityItems.map((item) => (
                    <Row
                      key={item.id}
                      label={resolveLabel(item.label)}
                      value={-item.value}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center py-3 px-4 -mx-4 rounded-lg bg-primary-foreground/10">
              <span className="text-sm font-medium">{t("results.netWealth")}</span>
              <span className="text-lg font-bold tabular-nums">
                {formatUSD(totals.netWealth)}
              </span>
            </div>
          </div>

          <div className="mt-8">
            <span className="text-sm opacity-80 block mb-2">
              {t("results.zakatDue")}
            </span>
            <div className="text-4xl sm:text-5xl font-bold tabular-nums">
              {formatUSD(totals.zakatDue)}
            </div>
            <p className="text-xs opacity-70 mt-2">
              {t("results.nisabLabel", { value: formatUSD(nisab) })}{" "}
              <span className="opacity-60">
                ({t(`settings.nisabSources.${settings.nisabSource}`)})
              </span>
            </p>
          </div>

          {belowNisab && (
            <div className="mt-6 p-4 bg-primary-foreground/10 rounded-lg flex gap-3 items-start">
              <Info className="size-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed opacity-90">
                {t("results.belowNisab")}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto pt-6 border-t border-primary-foreground/15">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onReset}
            className="w-full bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
          >
            <RefreshCcw className="size-4" />
            {t("results.reset")}
          </Button>
          <p className="text-[11px] italic opacity-70 mt-4 leading-relaxed text-center">
            {t("results.disclaimer")}
          </p>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center text-xs opacity-75">
      <span>{label}</span>
      <span className="tabular-nums">{formatUSD(value)}</span>
    </div>
  );
}
