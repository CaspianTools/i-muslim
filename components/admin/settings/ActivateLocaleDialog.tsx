"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  BUNDLED_LOCALES,
  LOCALE_META,
  RTL_LOCALES,
  type Locale,
} from "@/i18n/config";
import { activateUiLocale } from "@/app/[locale]/(admin)/admin/settings/_actions";

export type ActivateLocaleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: Locale | null;
  // Existing values when re-editing an already-activated reserved locale.
  initial?: {
    nativeName: string;
    englishName: string;
    flag: string;
    rtl: boolean;
    baseLocale: Locale;
    messages: Record<string, unknown>;
  };
  onSaved: () => void;
};

export function ActivateLocaleDialog({
  open,
  onOpenChange,
  code,
  initial,
  onSaved,
}: ActivateLocaleDialogProps) {
  const t = useTranslations("adminSettings.languages.activate");
  const tCommon = useTranslations("common");
  const meta = code ? LOCALE_META[code] : null;

  type FormState = {
    nativeName: string;
    englishName: string;
    flag: string;
    baseLocale: Locale;
    messagesText: string;
  };

  function buildInitialForm(): FormState {
    if (code && initial) {
      return {
        nativeName: initial.nativeName,
        englishName: initial.englishName,
        flag: initial.flag,
        baseLocale: initial.baseLocale,
        messagesText: JSON.stringify(initial.messages, null, 2),
      };
    }
    return {
      nativeName: meta?.nativeName ?? "",
      englishName: meta?.englishName ?? "",
      flag: meta?.flag ?? "",
      baseLocale: "en",
      messagesText: "{}",
    };
  }

  // Form state is initialised from props once; the parent passes a `key`
  // that includes the target code so React remounts and reinitialises the
  // form whenever the admin opens the dialog for a different reserved locale.
  const [form, setForm] = useState<FormState>(buildInitialForm);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { nativeName, englishName, flag, baseLocale, messagesText } = form;
  // Derived from the locale code itself — RTL_LOCALES is the source of truth
  // for which scripts read right-to-left, so the admin doesn't need to set it.
  const rtl = code ? RTL_LOCALES.has(code) : false;

  // Lazily fetch the chosen base locale's bundled translations and trigger a
  // browser download. Lazy so the JSON isn't shipped with the dialog's first
  // paint — it's ~50KB per locale.
  async function downloadBaseJson() {
    try {
      let messages: Record<string, unknown>;
      switch (baseLocale) {
        case "ar":
          messages = (await import("@/messages/ar.json")).default;
          break;
        case "tr":
          messages = (await import("@/messages/tr.json")).default;
          break;
        case "id":
          messages = (await import("@/messages/id.json")).default;
          break;
        case "en":
        default:
          messages = (await import("@/messages/en.json")).default;
          break;
      }
      const json = JSON.stringify(messages, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseLocale}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("[ActivateLocaleDialog] download failed:", err);
      toast.error(t("errorWriteFailed"));
    }
  }

  function tryParseMessages(): Record<string, unknown> | null {
    const trimmed = messagesText.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setParseError(t("errorNotObject"));
        return null;
      }
      setParseError(null);
      return parsed as Record<string, unknown>;
    } catch (err) {
      setParseError(
        err instanceof Error ? `${t("errorParse")}: ${err.message}` : t("errorParse"),
      );
      return null;
    }
  }

  function onSave() {
    if (!code) return;
    const messages = tryParseMessages();
    if (!messages) return;
    if (!nativeName.trim() || !englishName.trim() || !flag.trim()) {
      toast.error(t("errorMissingFields"));
      return;
    }
    startTransition(async () => {
      const res = await activateUiLocale({
        code,
        nativeName: nativeName.trim(),
        englishName: englishName.trim(),
        flag: flag.trim(),
        rtl,
        baseLocale,
        messages,
      });
      if (res.ok) {
        toast.success(initial ? t("savedToast") : t("activatedToast"));
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(t("errorWriteFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("titleEdit") : t("title")}
            {code ? ` — ${code.toUpperCase()}` : ""}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2 md:grid-cols-2">
          {/* Left column: metadata fields, stacked. */}
          <div className="space-y-4">
            <Field label={t("nativeName")} hint={t("nativeNameHint")}>
              <Input
                value={nativeName}
                onChange={(e) => setForm((s) => ({ ...s, nativeName: e.target.value }))}
                placeholder={t("nativeNamePlaceholder")}
                disabled={pending}
              />
            </Field>
            <Field label={t("englishName")} hint={t("englishNameHint")}>
              <Input
                value={englishName}
                onChange={(e) => setForm((s) => ({ ...s, englishName: e.target.value }))}
                placeholder={t("englishNamePlaceholder")}
                disabled={pending}
              />
            </Field>
            <Field label={t("flag")} hint={t("flagHint")}>
              <Input
                value={flag}
                onChange={(e) => setForm((s) => ({ ...s, flag: e.target.value }))}
                placeholder="🇫🇷"
                disabled={pending}
              />
            </Field>
            <Field label={t("baseLocale")} hint={t("baseLocaleHint")}>
              <select
                value={baseLocale}
                onChange={(e) => setForm((s) => ({ ...s, baseLocale: e.target.value as Locale }))}
                disabled={pending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              >
                {BUNDLED_LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l.toUpperCase()} · {LOCALE_META[l]?.nativeName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Right column: translations JSON. The textarea fills the column
              vertically so it lines up with the field stack on the left. */}
          <div className="flex min-h-0 flex-col space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">{t("messages")}</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={downloadBaseJson}
                disabled={pending}
              >
                <Download className="size-3.5" />
                {t("downloadBase", { locale: baseLocale.toUpperCase() })}
              </Button>
            </div>
            <textarea
              value={messagesText}
              onChange={(e) => {
                setForm((s) => ({ ...s, messagesText: e.target.value }));
                if (parseError) setParseError(null);
              }}
              disabled={pending}
              spellCheck={false}
              dir={rtl ? "rtl" : "ltr"}
              className="flex-1 min-h-[20rem] w-full resize-none rounded-md border border-input bg-background p-3 font-mono text-xs shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder='{ "common": { "save": "..." }, "header": { ... } }'
            />
            <p className="text-xs text-muted-foreground">
              {t("messagesHint")} — {t("downloadBaseHint", { locale: baseLocale.toUpperCase() })}
            </p>
            {parseError && (
              <p className="mt-1 text-xs text-destructive">{parseError}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={onSave} disabled={pending} aria-busy={pending}>
            {pending ? tCommon("loading") : initial ? t("saveEdit") : t("activate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
