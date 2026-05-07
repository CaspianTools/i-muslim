"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CurrencyCombobox } from "./CurrencyCombobox";
import { NumericInput } from "./NumericInput";
import type { CurrencyEntry } from "@/lib/zakat/types";
import { cn } from "@/lib/utils";

interface Props {
  entry: CurrencyEntry;
  onUpdate: (id: string, updates: Partial<CurrencyEntry>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export function MultiCurrencyLine({ entry, onUpdate, onRemove, canRemove }: Props) {
  const t = useTranslations("zakat");
  const isUSD = entry.currency === "USD";

  return (
    // At <sm: Amount fills its own row (col-span-3), Currency/Rate/Trash share
    // row 2 — keeps each input tappable and avoids a 78 px Amount field at
    // 390 px viewport. At sm+: classic 4-column row.
    <div className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_8rem_8rem_auto] gap-2 items-end animate-in fade-in slide-in-from-top-1 duration-200">
      <Field label={t("fields.amount")} className="col-span-3 sm:col-span-1">
        <NumericInput
          value={entry.amount}
          onChange={(val) => onUpdate(entry.id, { amount: val })}
        />
      </Field>
      <Field label={t("fields.currency")}>
        <CurrencyCombobox
          value={entry.currency}
          onChange={(code) =>
            onUpdate(entry.id, {
              currency: code,
              rate: code === "USD" ? 1 : entry.rate,
            })
          }
        />
      </Field>
      <Field label={t("fields.rateToUsd")} className={cn(isUSD && "opacity-50")}>
        <NumericInput
          value={entry.rate}
          step="0.0001"
          readOnly={isUSD}
          onChange={(val) => onUpdate(entry.id, { rate: val })}
          className={cn(
            "text-center",
            isUSD && "cursor-not-allowed bg-muted",
          )}
        />
      </Field>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("actions.removeRow")}
        onClick={() => onRemove(entry.id)}
        disabled={!canRemove}
        className="text-muted-foreground hover:text-danger"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-[11px] uppercase tracking-wide text-muted-foreground block">
        {label}
      </label>
      {children}
    </div>
  );
}
