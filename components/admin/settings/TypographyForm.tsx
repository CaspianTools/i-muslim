"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  BODY_FONT_OPTIONS,
  ARABIC_FONT_OPTIONS,
  type BodyFont,
  type ArabicFont,
} from "@/lib/site-config/typography";
import { updateTypographyAction } from "@/app/[locale]/(admin)/admin/settings/_actions";

interface Props {
  initial: {
    bodyFont: BodyFont;
    arabicFont: ArabicFont;
  };
}

// Each option carries the CSS variable Next.js assigns to the corresponding
// `next/font/google` import in app/layout.tsx, so the preview renders in the
// real face the admin would be picking — no external fetch required.
const BODY_FONT_PREVIEW: Record<BodyFont, { label: string; varName: string }> = {
  inter: { label: "Inter", varName: "--font-inter" },
  "plex-sans": { label: "IBM Plex Sans", varName: "--font-plex-sans" },
  roboto: { label: "Roboto", varName: "--font-roboto" },
};

const ARABIC_FONT_PREVIEW: Record<
  ArabicFont,
  { label: string; varName: string }
> = {
  amiri: { label: "Amiri", varName: "--font-amiri" },
  scheherazade: { label: "Scheherazade New", varName: "--font-scheherazade" },
  "noto-naskh": { label: "Noto Naskh Arabic", varName: "--font-noto-naskh" },
};

const ARABIC_PREVIEW_TEXT = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const BODY_PREVIEW_TEXT = "The quick brown fox jumps over the lazy dog.";

function FontTile({
  active,
  label,
  previewText,
  fontFamily,
  rtl,
  onClick,
}: {
  active: boolean;
  label: string;
  previewText: string;
  fontFamily: string;
  rtl?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-stretch gap-2 rounded-md border bg-background p-3 text-start transition-colors",
        active
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40",
      )}
      aria-pressed={active}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className="block truncate text-lg leading-snug"
        style={{ fontFamily }}
        dir={rtl ? "rtl" : undefined}
      >
        {previewText}
      </span>
    </button>
  );
}

export function TypographyForm({ initial }: Props) {
  const t = useTranslations("adminSettings.typography");
  const [bodyFont, setBodyFont] = useState<BodyFont>(initial.bodyFont);
  const [arabicFont, setArabicFont] = useState<ArabicFont>(initial.arabicFont);
  const [pending, startTransition] = useTransition();

  const dirty = bodyFont !== initial.bodyFont || arabicFont !== initial.arabicFont;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    startTransition(async () => {
      const result = await updateTypographyAction({ bodyFont, arabicFont });
      if (result.ok) {
        toast.success(t("savedToast"));
      } else {
        toast.error(t("errorToast"));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-3">
        <div>
          <Label className="text-base font-semibold">{t("bodyLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("bodyHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {BODY_FONT_OPTIONS.map((id) => {
            const meta = BODY_FONT_PREVIEW[id];
            return (
              <FontTile
                key={id}
                active={bodyFont === id}
                label={meta.label}
                previewText={BODY_PREVIEW_TEXT}
                fontFamily={`var(${meta.varName}), system-ui, sans-serif`}
                onClick={() => setBodyFont(id)}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <Label className="text-base font-semibold">{t("arabicLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("arabicHint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ARABIC_FONT_OPTIONS.map((id) => {
            const meta = ARABIC_FONT_PREVIEW[id];
            return (
              <FontTile
                key={id}
                active={arabicFont === id}
                label={meta.label}
                previewText={ARABIC_PREVIEW_TEXT}
                fontFamily={`var(${meta.varName}), serif`}
                rtl
                onClick={() => setArabicFont(id)}
              />
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? t("saving") : t("save")}
        </Button>
        {dirty && (
          <span className="text-xs text-muted-foreground">{t("unsavedChanges")}</span>
        )}
      </div>
    </form>
  );
}
