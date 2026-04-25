"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NumericInput } from "./NumericInput";
import { MAZHABS } from "@/lib/zakat/mazhab";
import type { Mazhab, NisabSource, UserSettings } from "@/lib/zakat/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: UserSettings;
  onMazhabChange: (mazhab: Mazhab) => void;
  onSettingsChange: (settings: UserSettings) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onMazhabChange,
  onSettingsChange,
}: Props) {
  const t = useTranslations("zakat");

  const setNisabSource = (source: NisabSource) => {
    onSettingsChange({ ...settings, nisabSource: source, mazhab: "custom" });
  };

  const toggleJewelry = () => {
    onSettingsChange({
      ...settings,
      jewelryExempt: !settings.jewelryExempt,
      mazhab: "custom",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          <section className="space-y-3">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
              {t("settings.mazhabLabel")}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {MAZHABS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMazhabChange(m)}
                  className={cn(
                    "py-2.5 px-2 rounded-md text-[11px] uppercase font-semibold tracking-wider transition-colors border",
                    settings.mazhab === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted",
                  )}
                >
                  {t(`settings.mazhabs.${m}`)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.mazhabHelp")}
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-3">
              <h4 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                {t("settings.nisabSourceLabel")}
              </h4>
              <div className="flex flex-col gap-2">
                {(["gold", "silver", "auto"] as NisabSource[]).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setNisabSource(source)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors border",
                      settings.nisabSource === source
                        ? "bg-primary/10 text-primary border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted",
                    )}
                  >
                    <span>{t(`settings.nisabSources.${source}`)}</span>
                    {settings.nisabSource === source && (
                      <Check className="size-4" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
                {t("settings.jewelryLabel")}
              </h4>
              <button
                type="button"
                onClick={toggleJewelry}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors border",
                  settings.jewelryExempt
                    ? "bg-success/10 text-success border-success"
                    : "bg-background text-foreground border-border hover:bg-muted",
                )}
              >
                <div className="text-left">
                  <p>{t("settings.jewelryExempt")}</p>
                  <p className="text-[11px] font-normal opacity-70 mt-0.5">
                    {t("settings.jewelryHelp")}
                  </p>
                </div>
                {settings.jewelryExempt ? (
                  <Check className="size-4" />
                ) : (
                  <div className="size-3.5 rounded-full border border-border" />
                )}
              </button>
            </section>
          </div>

          <section className="space-y-3 pt-4 border-t border-border">
            <h4 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
              {t("settings.thresholdsLabel")}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground italic">
                  {t("settings.goldThresholdHelp")}
                </p>
                <div className="relative">
                  <NumericInput
                    value={settings.goldNisabGrams}
                    step="0.01"
                    onChange={(val) =>
                      onSettingsChange({
                        ...settings,
                        goldNisabGrams: val,
                        mazhab: "custom",
                      })
                    }
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    g
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground italic">
                  {t("settings.silverThresholdHelp")}
                </p>
                <div className="relative">
                  <NumericInput
                    value={settings.silverNisabGrams}
                    step="0.01"
                    onChange={(val) =>
                      onSettingsChange({
                        ...settings,
                        silverNisabGrams: val,
                        mazhab: "custom",
                      })
                    }
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    g
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary" size="lg">
              {t("settings.save")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
