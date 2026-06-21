"use client";

import type { CSSProperties } from "react";
import { Type } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  FONT_BOUNDS,
  FONT_DEFAULTS,
  useReaderFont,
  type ReaderFontKind,
} from "@/lib/reading/reading-mode";

function FontSlider({ kind }: { kind: ReaderFontKind }) {
  const t = useTranslations("readingMode");
  const [size, setSize] = useReaderFont(kind);
  const { min, max, step } = FONT_BOUNDS[kind];
  const reset = () => setSize(FONT_DEFAULTS[kind]);
  const label = kind === "arabic" ? t("fontArabic") : t("fontTranslation");
  const isDefault = size === FONT_DEFAULTS[kind];
  const pct = ((size - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex min-w-[2.25rem] justify-center rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs tabular-nums"
            aria-live="polite"
          >
            {size}
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={isDefault}
            className="text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            aria-label={t("fontReset", { label })}
          >
            {t("reset")}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="select-none text-xs leading-none text-muted-foreground"
        >
          A
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          aria-label={label}
          className="reader-range flex-1"
          style={{ "--reader-range-pct": `${pct}%` } as CSSProperties}
        />
        <span
          aria-hidden="true"
          className="select-none text-base leading-none text-muted-foreground"
        >
          A
        </span>
      </div>
    </div>
  );
}

/**
 * Pair of size sliders for Arabic and translation font size. Sits in the
 * Quran / Hadith filters panel so the same control is reachable in normal
 * mode and in reading mode (the filters drawer remains accessible).
 */
export function ReadingFontControls() {
  const t = useTranslations("readingMode");
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Type className="size-3.5" />
        {t("fontSection")}
      </h3>
      <FontSlider kind="arabic" />
      <FontSlider kind="translation" />
    </section>
  );
}
