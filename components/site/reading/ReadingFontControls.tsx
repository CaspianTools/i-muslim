"use client";

import { Minus, Plus, Type } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  FONT_BOUNDS,
  FONT_DEFAULTS,
  useReaderFont,
  type ReaderFontKind,
} from "@/lib/reading/reading-mode";

function FontStepper({ kind }: { kind: ReaderFontKind }) {
  const t = useTranslations("readingMode");
  const [size, setSize] = useReaderFont(kind);
  const { min, max, step } = FONT_BOUNDS[kind];
  const dec = () => setSize(size - step);
  const inc = () => setSize(size + step);
  const reset = () => setSize(FONT_DEFAULTS[kind]);
  const label = kind === "arabic" ? t("fontArabic") : t("fontTranslation");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={reset}
          className="text-[11px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
          aria-label={t("fontReset", { label })}
        >
          {t("reset")}
        </button>
      </div>
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={dec}
          disabled={size <= min}
          aria-label={t("fontDecrease", { label })}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md border ui-selected-chip-idle transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Minus className="size-4" />
        </button>
        <span
          className="inline-flex h-9 min-w-[3rem] items-center justify-center rounded-md border border-border bg-muted/50 px-2 text-sm tabular-nums"
          aria-live="polite"
        >
          {size}
        </span>
        <button
          type="button"
          onClick={inc}
          disabled={size >= max}
          aria-label={t("fontIncrease", { label })}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md border ui-selected-chip-idle transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Pair of A−/A+ steppers for Arabic and translation font size. Sits in the
 * Quran / Hadith filters panel so the same control is reachable in normal
 * mode and in reading mode (the filters drawer remains accessible).
 */
export function ReadingFontControls() {
  const t = useTranslations("readingMode");
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Type className="size-3.5" />
        {t("fontSection")}
      </h3>
      <FontStepper kind="arabic" />
      <FontStepper kind="translation" />
    </section>
  );
}
