"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { ALL_LANGS, type LangCode } from "@/lib/translations";
import { updateLanguageSettings } from "@/app/[locale]/(admin)/admin/settings/_actions";

const UI_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  ar: "🇸🇦",
  tr: "🇹🇷",
  id: "🇮🇩",
};

const UI_NATIVE: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  tr: "Türkçe",
  id: "Bahasa Indonesia",
};

const CONTENT_FLAGS: Record<string, string> = {
  ar: "🇸🇦",
  en: "🇬🇧",
  ru: "🇷🇺",
  az: "🇦🇿",
  tr: "🇹🇷",
};

const CONTENT_NATIVE: Record<string, string> = {
  ar: "العربية",
  en: "English",
  ru: "Русский",
  az: "Azərbaycanca",
  tr: "Türkçe",
};

const CONTENT_DEFAULT: LangCode = "ar";

export type LanguagesFormProps = {
  initial: {
    uiEnabled: Locale[];
    contentEnabled: LangCode[];
  };
};

function setEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set<T>(a);
  return b.every((v) => set.has(v));
}

export function LanguagesForm({ initial }: LanguagesFormProps) {
  const t = useTranslations("adminSettings.languages");
  const tCommon = useTranslations("common");

  const [uiEnabled, setUiEnabled] = useState<Set<Locale>>(
    () => new Set(initial.uiEnabled),
  );
  const [contentEnabled, setContentEnabled] = useState<Set<LangCode>>(
    () => new Set(initial.contentEnabled),
  );
  const [pending, startTransition] = useTransition();
  const [savedSnapshot, setSavedSnapshot] = useState({
    ui: initial.uiEnabled,
    content: initial.contentEnabled,
  });

  const dirty = useMemo(() => {
    const uiNow = LOCALES.filter((l) => uiEnabled.has(l));
    const contentNow = ALL_LANGS.filter((l) => contentEnabled.has(l));
    return (
      !setEqual(uiNow, savedSnapshot.ui) ||
      !setEqual(contentNow, savedSnapshot.content)
    );
  }, [uiEnabled, contentEnabled, savedSnapshot]);

  function toggleUi(code: Locale) {
    if (code === DEFAULT_LOCALE) return;
    setUiEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleContent(code: LangCode) {
    if (code === CONTENT_DEFAULT) return;
    setContentEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function onSave() {
    const payload = {
      uiEnabled: LOCALES.filter((l) => uiEnabled.has(l)),
      contentEnabled: ALL_LANGS.filter((l) => contentEnabled.has(l)),
    };
    startTransition(async () => {
      const res = await updateLanguageSettings(payload);
      if (res.ok) {
        setSavedSnapshot({
          ui: res.settings.uiEnabled,
          content: res.settings.contentEnabled,
        });
        setUiEnabled(new Set(res.settings.uiEnabled));
        setContentEnabled(new Set(res.settings.contentEnabled));
        toast.success(t("savedToast"));
      } else {
        toast.error(t("errorToast"));
      }
    });
  }

  return (
    <div className="space-y-8">
      <Section
        title={t("uiSection")}
        description={t("uiDescription")}
      >
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {LOCALES.map((code) => {
            const isDefault = code === DEFAULT_LOCALE;
            const checked = uiEnabled.has(code) || isDefault;
            return (
              <LanguageRow
                key={code}
                code={code}
                flag={UI_FLAGS[code]}
                native={UI_NATIVE[code]}
                checked={checked}
                isDefault={isDefault}
                defaultHint={t("defaultLockedHint")}
                onToggle={() => toggleUi(code)}
              />
            );
          })}
        </ul>
      </Section>

      <Section
        title={t("contentSection")}
        description={t("contentDescription")}
      >
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {ALL_LANGS.map((code) => {
            const isDefault = code === CONTENT_DEFAULT;
            const checked = contentEnabled.has(code) || isDefault;
            return (
              <LanguageRow
                key={code}
                code={code}
                flag={CONTENT_FLAGS[code] ?? "🌐"}
                native={CONTENT_NATIVE[code] ?? code.toUpperCase()}
                checked={checked}
                isDefault={isDefault}
                defaultHint={t("defaultLockedHint")}
                onToggle={() => toggleContent(code)}
              />
            );
          })}
        </ul>
      </Section>

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-xs text-muted-foreground">
            {t("unsavedChanges")}
          </span>
        )}
        <Button
          type="button"
          onClick={onSave}
          disabled={!dirty || pending}
          aria-busy={pending}
        >
          {pending ? tCommon("loading") : t("save")}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function LanguageRow({
  code,
  flag,
  native,
  checked,
  isDefault,
  defaultHint,
  onToggle,
}: {
  code: string;
  flag: string;
  native: string;
  checked: boolean;
  isDefault: boolean;
  defaultHint: string;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="text-xl leading-none">
          {flag}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{native}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {code}
            {isDefault ? ` · ${defaultHint}` : ""}
          </p>
        </div>
      </div>
      <ToggleSwitch
        checked={checked}
        disabled={isDefault}
        onChange={onToggle}
        label={native}
      />
    </li>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked
          ? "bg-primary"
          : "bg-muted",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "pointer-events-none inline-block size-5 transform rounded-full bg-background shadow-sm ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
