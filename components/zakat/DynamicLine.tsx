"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "./NumericInput";
import type { GenericEntry } from "@/lib/zakat/types";

interface Props {
  entry: GenericEntry;
  onUpdate: (id: string, updates: Partial<GenericEntry>) => void;
  onRemove: (id: string) => void;
  labelPlaceholder: string;
  resolveLabel: (label: string) => string;
}

export function DynamicLine({
  entry,
  onUpdate,
  onRemove,
  labelPlaceholder,
  resolveLabel,
}: Props) {
  const t = useTranslations("zakat");

  return (
    <div className="grid grid-cols-[1.5fr_1fr_auto] gap-2 items-end">
      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground block">
          {labelPlaceholder}
        </label>
        <Input
          type="text"
          value={resolveLabel(entry.label)}
          placeholder={labelPlaceholder}
          onChange={(e) => onUpdate(entry.id, { label: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground block">
          {t("fields.valueUsd")}
        </label>
        <NumericInput
          value={entry.value}
          onChange={(val) => onUpdate(entry.id, { value: val })}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("actions.removeRow")}
        onClick={() => onRemove(entry.id)}
        className="text-muted-foreground hover:text-danger"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
