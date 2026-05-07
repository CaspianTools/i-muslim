"use client";

import { useState } from "react";
import { ChevronDown, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatUSD } from "@/lib/zakat/calculate";

interface Props {
  zakatDue: number;
  netWealth: number;
  nisab: number;
}

/**
 * Compact summary chip pinned above the bottom tab bar on /zakat. Surfaces
 * the calculator's headline number while the user is mid-input, since
 * scrolling 2,800 px down to confirm "did this cross nisab?" is the audit's
 * canonical example of a calculator burying its own purpose.
 *
 * `md:hidden` because at desktop widths the existing ResultsPanel already
 * sits sticky to the side via `lg:sticky lg:top-20` (defined in
 * components/zakat/ResultsPanel.tsx). At <md the ResultsPanel falls to the
 * bottom of the page; this chip re-surfaces the headline.
 *
 * Two-state: collapsed shows the headline number; expanded reveals net
 * wealth + nisab status. Both states sit `bottom-[calc(4rem + safe-area)]`
 * to clear the MobileBottomTabBar.
 */
export function MobileZakatSummary({ zakatDue, netWealth, nisab }: Props) {
  const t = useTranslations("zakat.results");
  const [open, setOpen] = useState(false);
  const aboveNisab = netWealth >= nisab;

  return (
    <div
      className="md:hidden fixed inset-x-0 z-30"
      style={{
        bottom: "calc(4rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto max-w-md px-3 pb-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full rounded-md border border-border bg-card text-card-foreground shadow-md p-3 text-start"
        >
          <div className="flex items-center gap-3">
            <Wallet className="size-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("zakatDue")}
              </p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {formatUSD(zakatDue)}
              </p>
            </div>
            <ChevronDown
              aria-hidden="true"
              className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
          {open && (
            <div className="mt-3 border-t border-border pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("netWealth")}</span>
                <span className="tabular-nums text-foreground">
                  {formatUSD(netWealth)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {t("nisabLabel", { value: formatUSD(nisab) })}
                </span>
                <span
                  className={`tabular-nums font-medium ${aboveNisab ? "text-success" : "text-warning"}`}
                >
                  {aboveNisab ? t("aboveNisab") : t("belowNisabShort")}
                </span>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
