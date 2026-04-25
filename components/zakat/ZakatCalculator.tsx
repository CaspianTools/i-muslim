"use client";

import * as React from "react";
import {
  ArrowRight,
  Building2,
  Coins,
  Gem,
  Globe,
  HandCoins,
  Settings as SettingsIcon,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AssetSection } from "./AssetSection";
import { MultiCurrencyLine } from "./MultiCurrencyLine";
import { ReceivableLine } from "./ReceivableLine";
import { DynamicLine } from "./DynamicLine";
import { NumericInput } from "./NumericInput";
import { ResultsPanel } from "./ResultsPanel";
import { SettingsDialog } from "./SettingsDialog";
import { SyncRatesButton } from "./SyncRatesButton";
import {
  computeNisab,
  computeTotals,
  formatUSD,
} from "@/lib/zakat/calculate";
import {
  STORAGE_KEY,
  initialState,
  reducer,
} from "@/lib/zakat/state";
import type { ZakatState } from "@/lib/zakat/types";

export function ZakatCalculator() {
  const t = useTranslations("zakat");
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const hydratedRef = React.useRef(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ZakatState;
        dispatch({ type: "HYDRATE", state: parsed });
      }
    } catch {
      // ignore corrupt storage
    }
    hydratedRef.current = true;
  }, []);

  React.useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage may be unavailable / full
    }
  }, [state]);

  const totals = React.useMemo(() => computeTotals(state), [state]);
  const nisab = React.useMemo(
    () => computeNisab(state.settings, state.goldPrice, state.silverPrice),
    [state.settings, state.goldPrice, state.silverPrice],
  );

  const resolveLabel = React.useCallback(
    (label: string) => {
      if (label.includes(".") && t.has(label)) return t(label);
      return label;
    },
    [t],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("title")}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-muted-foreground italic">{t("subtitle")}</p>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-widest font-semibold">
              {t(`settings.mazhabs.${state.settings.mazhab}`)}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="self-start sm:self-end"
          >
            <SettingsIcon className="size-4" />
            {t("settingsButton")}
          </Button>
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Globe className="size-3 text-success" />
              {t("nisabLabel")}
            </span>
            <span className="text-2xl font-bold tabular-nums text-primary">
              {formatUSD(nisab)}
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <section className="space-y-5 min-w-0">
          <AssetSection
            icon={<Wallet className="size-4" />}
            title={t("sections.cash")}
            trailing={
              <SyncRatesButton
                onApply={(r) =>
                  dispatch({
                    type: "APPLY_RATES",
                    fx: r.fx,
                    gold: r.gold,
                    silver: r.silver,
                  })
                }
              />
            }
            onAdd={() => dispatch({ type: "ADD_CURRENCY", bucket: "cash" })}
            addLabel={t("actions.addCash")}
            subtotal={{
              label: t("subtotalUsd"),
              value: totals.breakdown.find((b) => b.id === "cash")?.value ?? 0,
            }}
          >
            {state.cash.map((entry) => (
              <MultiCurrencyLine
                key={entry.id}
                entry={entry}
                canRemove={state.cash.length > 1}
                onUpdate={(id, updates) =>
                  dispatch({
                    type: "UPDATE_CURRENCY",
                    bucket: "cash",
                    id,
                    updates,
                  })
                }
                onRemove={(id) =>
                  dispatch({ type: "REMOVE_CURRENCY", bucket: "cash", id })
                }
              />
            ))}
          </AssetSection>

          <AssetSection
            icon={<Building2 className="size-4" />}
            title={t("sections.bank")}
            onAdd={() => dispatch({ type: "ADD_CURRENCY", bucket: "bank" })}
            addLabel={t("actions.addBank")}
            subtotal={{
              label: t("subtotalUsd"),
              value: totals.breakdown.find((b) => b.id === "bank")?.value ?? 0,
            }}
          >
            {state.bank.map((entry) => (
              <MultiCurrencyLine
                key={entry.id}
                entry={entry}
                canRemove={state.bank.length > 1}
                onUpdate={(id, updates) =>
                  dispatch({
                    type: "UPDATE_CURRENCY",
                    bucket: "bank",
                    id,
                    updates,
                  })
                }
                onRemove={(id) =>
                  dispatch({ type: "REMOVE_CURRENCY", bucket: "bank", id })
                }
              />
            ))}
          </AssetSection>

          <AssetSection
            icon={<ArrowRight className="size-4" />}
            title={t("sections.receivables")}
            onAdd={() => dispatch({ type: "ADD_RECEIVABLE" })}
            addLabel={t("actions.addReceivable")}
            subtotal={{
              label: t("subtotalOwed"),
              value:
                totals.breakdown.find((b) => b.id === "receivables")?.value ?? 0,
            }}
          >
            {state.receivables.map((entry) => (
              <ReceivableLine
                key={entry.id}
                entry={entry}
                onUpdate={(id, updates) =>
                  dispatch({ type: "UPDATE_RECEIVABLE", id, updates })
                }
                onRemove={(id) => dispatch({ type: "REMOVE_RECEIVABLE", id })}
              />
            ))}
          </AssetSection>

          <Card className="p-5">
            <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
              <Gem className="size-4 text-primary" />
              <h3 className="text-xs uppercase tracking-widest font-semibold">
                {t("sections.precious")}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PreciousField
                label={t("fields.goldWeight")}
                rateLabel={t("fields.ratePerGram", {
                  value: formatUSD(state.goldPrice),
                })}
                value={state.goldWeight}
                price={state.goldPrice}
                onChange={(v) =>
                  dispatch({ type: "SET_GOLD_WEIGHT", value: v })
                }
              />
              <PreciousField
                label={t("fields.silverWeight")}
                rateLabel={t("fields.ratePerGram", {
                  value: formatUSD(state.silverPrice),
                })}
                value={state.silverWeight}
                price={state.silverPrice}
                onChange={(v) =>
                  dispatch({ type: "SET_SILVER_WEIGHT", value: v })
                }
              />
            </div>
          </Card>

          <AssetSection
            icon={<Coins className="size-4" />}
            title={t("sections.investments")}
            onAdd={() =>
              dispatch({ type: "ADD_GENERIC", bucket: "investments" })
            }
            addLabel={t("actions.addInvestment")}
          >
            {state.investments.map((entry) => (
              <DynamicLine
                key={entry.id}
                entry={entry}
                labelPlaceholder={t("fields.investmentType")}
                resolveLabel={resolveLabel}
                onUpdate={(id, updates) =>
                  dispatch({
                    type: "UPDATE_GENERIC",
                    bucket: "investments",
                    id,
                    updates,
                  })
                }
                onRemove={(id) =>
                  dispatch({
                    type: "REMOVE_GENERIC",
                    bucket: "investments",
                    id,
                  })
                }
              />
            ))}
          </AssetSection>

          <AssetSection
            icon={<Building2 className="size-4" />}
            title={t("sections.business")}
            onAdd={() => dispatch({ type: "ADD_GENERIC", bucket: "business" })}
            addLabel={t("actions.addBusiness")}
          >
            {state.business.map((entry) => (
              <DynamicLine
                key={entry.id}
                entry={entry}
                labelPlaceholder={t("fields.assetCategory")}
                resolveLabel={resolveLabel}
                onUpdate={(id, updates) =>
                  dispatch({
                    type: "UPDATE_GENERIC",
                    bucket: "business",
                    id,
                    updates,
                  })
                }
                onRemove={(id) =>
                  dispatch({
                    type: "REMOVE_GENERIC",
                    bucket: "business",
                    id,
                  })
                }
              />
            ))}
          </AssetSection>

          <AssetSection
            icon={<HandCoins className="size-4" />}
            title={t("sections.liabilities")}
            onAdd={() =>
              dispatch({ type: "ADD_GENERIC", bucket: "liabilities" })
            }
            addLabel={t("actions.addLiability")}
          >
            {state.liabilities.map((entry) => (
              <DynamicLine
                key={entry.id}
                entry={entry}
                labelPlaceholder={t("fields.liabilityDescription")}
                resolveLabel={resolveLabel}
                onUpdate={(id, updates) =>
                  dispatch({
                    type: "UPDATE_GENERIC",
                    bucket: "liabilities",
                    id,
                    updates,
                  })
                }
                onRemove={(id) =>
                  dispatch({
                    type: "REMOVE_GENERIC",
                    bucket: "liabilities",
                    id,
                  })
                }
              />
            ))}
          </AssetSection>

          <Card className="p-5">
            <h3 className="text-xs uppercase tracking-widest font-semibold border-b border-border pb-3 mb-4">
              {t("sections.marketPrices")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground italic block">
                  {t("fields.goldPrice")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <NumericInput
                    value={state.goldPrice}
                    onChange={(v) =>
                      dispatch({ type: "SET_GOLD_PRICE", value: v })
                    }
                    className="pl-6"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground italic block">
                  {t("fields.silverPrice")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <NumericInput
                    value={state.silverPrice}
                    onChange={(v) =>
                      dispatch({ type: "SET_SILVER_PRICE", value: v })
                    }
                    className="pl-6"
                  />
                </div>
              </div>
            </div>
          </Card>
        </section>

        <ResultsPanel
          totals={totals}
          nisab={nisab}
          settings={state.settings}
          resolveLabel={resolveLabel}
          onReset={() => dispatch({ type: "RESET" })}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={state.settings}
        onMazhabChange={(m) => dispatch({ type: "SET_MAZHAB", mazhab: m })}
        onSettingsChange={(s) => dispatch({ type: "SET_SETTINGS", settings: s })}
      />
    </div>
  );
}

interface PreciousFieldProps {
  label: string;
  rateLabel: string;
  value: number;
  price: number;
  onChange: (val: number) => void;
}

function PreciousField({
  label,
  rateLabel,
  value,
  price,
  onChange,
}: PreciousFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <label>{label}</label>
        <span className="italic">{rateLabel}</span>
      </div>
      <div className="relative">
        <NumericInput value={value} onChange={onChange} className="pr-8" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          g
        </span>
      </div>
      <div className="text-xs text-warning text-right tabular-nums">
        {formatUSD(value * price)}
      </div>
    </div>
  );
}
