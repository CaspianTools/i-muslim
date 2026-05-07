"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  LOCALES,
  LOCALE_META,
  DEFAULT_LOCALE,
  BUNDLED_LOCALES,
  type Locale,
} from "@/i18n/config";
import { ALL_LANGS, type LangCode } from "@/lib/translations";
import { updateLanguageSettings, deactivateUiLocaleAction } from "@/app/[locale]/(admin)/admin/settings/_actions";
import { ActivateLocaleDialog } from "./ActivateLocaleDialog";
import { EditTranslationsDialog } from "./EditTranslationsDialog";
import { ContentLangDialog } from "./ContentLangDialog";
import type { MessageTree } from "@/lib/i18n/translation-stats";

type BundledCode = "en" | "ar" | "tr" | "id";
const BUNDLED_CODES = new Set<BundledCode>(["en", "ar", "tr", "id"]);
function isBundledCode(code: string): code is BundledCode {
  return BUNDLED_CODES.has(code as BundledCode);
}

// Loaded on demand when the admin opens the phrase editor — keeps the static
// bundle for /admin/settings small (~no JSON until a click).
async function loadBundledMessages(code: BundledCode): Promise<MessageTree> {
  switch (code) {
    case "ar":
      return (await import("@/messages/ar.json")).default as MessageTree;
    case "tr":
      return (await import("@/messages/tr.json")).default as MessageTree;
    case "id":
      return (await import("@/messages/id.json")).default as MessageTree;
    case "en":
    default:
      return (await import("@/messages/en.json")).default as MessageTree;
  }
}

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

export type ReservedLocaleSummary = {
  code: Locale;
  activated: boolean;
  nativeName: string;
  englishName: string;
  flag: string;
  rtl: boolean;
  baseLocale: Locale;
  messages: Record<string, unknown>;
  // Server-computed translation completion against the base locale.
  // 0 when not activated.
  stats: { total: number; translated: number; percent: number };
};

export type ContentStats = {
  total: number;
  perLang: Partial<Record<LangCode, number>>;
};

export type HadithStats = ContentStats & {
  perCollection: Record<
    string,
    { total: number; perLang: Partial<Record<LangCode, number>> }
  >;
};

export type LanguagesScope = "interface" | "quran" | "hadith";

export type LanguagesFormProps = {
  scope: LanguagesScope;
  // Locales the current session can edit translations for. Computed at the
  // server boundary by `editableLanguagesFor("uiLocales.translate", LOCALES)`.
  // Anything not in this list opens the editor in read-only mode.
  editableLanguages: Locale[];
  initial: {
    uiEnabled: Locale[];
    quranEnabled: LangCode[];
    hadithEnabled: LangCode[];
    quranStats: ContentStats;
    hadithStats: HadithStats;
    reservedLocales: ReservedLocaleSummary[];
  };
};

function setEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set<T>(a);
  return b.every((v) => set.has(v));
}

export function LanguagesForm({
  scope,
  editableLanguages,
  initial,
}: LanguagesFormProps) {
  const editableSet = useMemo(
    () => new Set<Locale>(editableLanguages),
    [editableLanguages],
  );
  const t = useTranslations("adminSettings.languages");
  const tCommon = useTranslations("common");

  // ── Per-tab working state + saved snapshot. Save buttons compare working ↔
  //    snapshot to compute dirty per-tab.
  const [uiEnabled, setUiEnabled] = useState<Set<Locale>>(() => new Set(initial.uiEnabled));
  const [quranEnabled, setQuranEnabled] = useState<Set<LangCode>>(() => new Set(initial.quranEnabled));
  const [hadithEnabled, setHadithEnabled] = useState<Set<LangCode>>(() => new Set(initial.hadithEnabled));
  const [reserved, setReserved] = useState<ReservedLocaleSummary[]>(initial.reservedLocales);

  const [savedSnapshot, setSavedSnapshot] = useState({
    ui: initial.uiEnabled,
    quran: initial.quranEnabled,
    hadith: initial.hadithEnabled,
  });

  const [pending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<"ui" | "quran" | "hadith" | null>(null);

  // ── Dirty flags per tab.
  const uiDirty = useMemo(() => {
    const now = LOCALES.filter((l) => uiEnabled.has(l));
    return !setEqual(now, savedSnapshot.ui);
  }, [uiEnabled, savedSnapshot.ui]);

  const quranDirty = useMemo(() => {
    const now = ALL_LANGS.filter((l) => quranEnabled.has(l));
    return !setEqual(now, savedSnapshot.quran);
  }, [quranEnabled, savedSnapshot.quran]);

  const hadithDirty = useMemo(() => {
    const now = ALL_LANGS.filter((l) => hadithEnabled.has(l));
    return !setEqual(now, savedSnapshot.hadith);
  }, [hadithEnabled, savedSnapshot.hadith]);

  // Activated subset — used to gate the Interface toggle (a reserved locale
  // has to be activated before it can be toggled into the public switcher).
  const activatedReserved: Set<Locale> = useMemo(() => {
    const out = new Set<Locale>();
    for (const r of reserved) if (r.activated) out.add(r.code);
    return out;
  }, [reserved]);

  function isUsable(code: Locale): boolean {
    return (BUNDLED_LOCALES as readonly string[]).includes(code) || activatedReserved.has(code);
  }

  function toggleUi(code: Locale) {
    if (code === DEFAULT_LOCALE) return;
    if (!isUsable(code)) return;
    setUiEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleContent(setEn: typeof setQuranEnabled, code: LangCode) {
    if (code === CONTENT_DEFAULT) return;
    setEn((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  // ── Saves. Each tab's button only modifies its own slice on the server;
  //    the action requires all three fields, so we send saved-snapshot values
  //    for the other two and the current working set for the active tab.
  function save(tab: "ui" | "quran" | "hadith") {
    const payload = {
      uiEnabled: tab === "ui" ? LOCALES.filter((l) => uiEnabled.has(l)) : savedSnapshot.ui,
      quranEnabled: tab === "quran" ? ALL_LANGS.filter((l) => quranEnabled.has(l)) : savedSnapshot.quran,
      hadithEnabled: tab === "hadith" ? ALL_LANGS.filter((l) => hadithEnabled.has(l)) : savedSnapshot.hadith,
    };
    setPendingTab(tab);
    startTransition(async () => {
      try {
        const res = await updateLanguageSettings(payload);
        if (res.ok) {
          setSavedSnapshot({
            ui: res.settings.uiEnabled,
            quran: res.settings.quranEnabled,
            hadith: res.settings.hadithEnabled,
          });
          setUiEnabled(new Set(res.settings.uiEnabled));
          setQuranEnabled(new Set(res.settings.quranEnabled));
          setHadithEnabled(new Set(res.settings.hadithEnabled));
          toast.success(t("savedToast"));
        } else {
          toast.error(t("errorToast"));
        }
      } finally {
        setPendingTab(null);
      }
    });
  }

  // ── Reserved-locale dialogs. Activate dialog (paste-JSON) is for first-time
  //    activation; Edit dialog (phrase editor) is for incremental edits on
  //    already-activated locales.
  const [activateOpen, setActivateOpen] = useState(false);
  const [activatingCode, setActivatingCode] = useState<Locale | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCode, setEditorCode] = useState<Locale | null>(null);
  const [editorBaseMessages, setEditorBaseMessages] = useState<MessageTree | null>(null);

  // Editor target — bundled locales render through the same overlay model
  // (the page builds an `effectiveOverlay` that already merges bundled JSON +
  // any Firestore overlay). Reserved locales must be `activated` to have an
  // editable overlay; for unactivated rows the activation flow runs first.
  const editorTarget = useMemo(() => {
    if (!editorCode) return undefined;
    const found = reserved.find((r) => r.code === editorCode);
    if (!found) return undefined;
    if ((BUNDLED_LOCALES as readonly string[]).includes(editorCode)) return found;
    return found.activated ? found : undefined;
  }, [editorCode, reserved]);

  function openActivateDialog(code: Locale) {
    setActivatingCode(code);
    setActivateOpen(true);
  }

  async function openEditor(code: Locale) {
    const found = reserved.find((r) => r.code === code);
    if (!found) return;
    // Reserved + unactivated rows can't open the editor — there's no overlay
    // to view yet. The toggle / row click should run the activation flow
    // through `openActivateDialog` instead.
    if (
      !(BUNDLED_LOCALES as readonly string[]).includes(code) &&
      !found.activated
    ) {
      return;
    }
    const baseCode: BundledCode = isBundledCode(found.baseLocale)
      ? found.baseLocale
      : "en";
    const baseMessages = await loadBundledMessages(baseCode);
    setEditorBaseMessages(baseMessages);
    setEditorCode(code);
    setEditorOpen(true);
  }

  function onActivateSaved() {
    if (!activatingCode) return;
    setReserved((prev) =>
      prev.map((r) => (r.code === activatingCode ? { ...r, activated: true } : r)),
    );
    // The admin clicked the toggle on an unactivated row to activate; their
    // intent is "make this language visible". Mirror that into uiEnabled
    // locally so the toggle reads ON without a second click. The change
    // shows up as dirty in the SaveBar so admin still confirms with Save.
    setUiEnabled((prev) => {
      if (prev.has(activatingCode)) return prev;
      const next = new Set(prev);
      next.add(activatingCode);
      return next;
    });
  }

  function onEditorSaved(newOverlay: MessageTree, percent: number) {
    if (!editorCode) return;
    setReserved((prev) =>
      prev.map((r) =>
        r.code === editorCode
          ? {
              ...r,
              messages: newOverlay as Record<string, unknown>,
              stats: { total: r.stats.total, translated: Math.round((percent / 100) * r.stats.total), percent },
            }
          : r,
      ),
    );
  }

  // ── Content (Qur'an / Hadith) language popup. Shows real translation
  //    completion stats from Firestore + a per-collection breakdown for
  //    Hadith. Click any row's name area to open.
  const [contentDialogOpen, setContentDialogOpen] = useState(false);
  const [contentDialogKind, setContentDialogKind] = useState<"quran" | "hadith">("quran");
  const [contentDialogCode, setContentDialogCode] = useState<LangCode | null>(null);

  function openContentDialog(kind: "quran" | "hadith", code: LangCode) {
    setContentDialogKind(kind);
    setContentDialogCode(code);
    setContentDialogOpen(true);
  }

  function onDeactivate(code: Locale) {
    startTransition(async () => {
      const res = await deactivateUiLocaleAction(code);
      if (res.ok) {
        setReserved((prev) => prev.map((r) => (r.code === code ? { ...r, activated: false } : r)));
        // If the locale was enabled in uiEnabled, drop it — a deactivated
        // locale shouldn't leak into the public switcher.
        setUiEnabled((prev) => {
          if (!prev.has(code)) return prev;
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
        toast.success(t("deactivatedToast"));
      } else {
        toast.error(t("errorToast"));
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {scope === "interface" && (
        <div className="space-y-4">
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {LOCALES.map((code) => {
            const isDefault = code === DEFAULT_LOCALE;
            const reservedDoc = reserved.find((r) => r.code === code);
            const status: "bundled" | "activated" | "unactivated" =
              (BUNDLED_LOCALES as readonly string[]).includes(code)
                ? "bundled"
                : reservedDoc?.activated
                  ? "activated"
                  : "unactivated";
            const meta = LOCALE_META[code];
            const checked = uiEnabled.has(code) || isDefault;

            const canEdit = editableSet.has(code);
            return (
              <li
                key={code}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (status === "unactivated") openActivateDialog(code);
                    else openEditor(code);
                  }}
                  disabled={pending}
                  aria-label={t("openEditor")}
                  className="group -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden className="text-xl leading-none">
                    {reservedDoc?.flag || meta?.flag || "🌐"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium group-hover:underline">
                      {reservedDoc?.nativeName || meta?.nativeName || code.toUpperCase()}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {code}
                      {isDefault
                        ? ` · ${t("defaultLockedHint")}`
                        : status === "activated"
                          ? ` · ${t("activatedHint")}`
                          : status === "unactivated"
                            ? ` · ${t("notActivatedHint")}`
                            : ""}
                      {!canEdit && status !== "unactivated"
                        ? ` · ${t("editor.readOnlyBadge")}`
                        : ""}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {status === "activated" && reservedDoc && (
                    <>
                      <ProgressChip
                        percent={reservedDoc.stats.percent}
                        translated={reservedDoc.stats.translated}
                        total={reservedDoc.stats.total}
                        label={t("progressChipLabel", {
                          percent: reservedDoc.stats.percent,
                        })}
                        onClick={() => openEditor(code)}
                        disabled={pending}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeactivate(code)}
                        disabled={pending}
                        aria-label={t("deactivate")}
                        title={t("deactivate")}
                      >
                        <Power className="size-3.5" />
                      </Button>
                    </>
                  )}
                  {/*
                    Unactivated reserved row: the toggle itself is the
                    activation affordance. We force `checked={false}` so the
                    visual matches the locale's actual usability, regardless
                    of whether `uiEnabled` happens to include the code via
                    the default.
                  */}
                  <ToggleSwitch
                    checked={status === "unactivated" ? false : checked}
                    disabled={isDefault || pending}
                    onChange={() => {
                      if (status === "unactivated") openActivateDialog(code);
                      else toggleUi(code);
                    }}
                    label={meta?.nativeName ?? code}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <SaveBar
          dirty={uiDirty}
          pending={pending && pendingTab === "ui"}
          onSave={() => save("ui")}
          tCommon={tCommon}
          t={t}
        />
        </div>
      )}

      {scope === "quran" && (
        <div className="space-y-4">
          <ContentLangList
            enabled={quranEnabled}
            stats={initial.quranStats}
            onToggle={(c) => toggleContent(setQuranEnabled, c)}
            onRowClick={(c) => openContentDialog("quran", c)}
            defaultHint={t("defaultLockedHint")}
            chipLabel={(percent) => t("progressChipLabel", { percent })}
          />

          <SaveBar
            dirty={quranDirty}
            pending={pending && pendingTab === "quran"}
            onSave={() => save("quran")}
            tCommon={tCommon}
            t={t}
          />
        </div>
      )}

      {scope === "hadith" && (
        <div className="space-y-4">
          <ContentLangList
            enabled={hadithEnabled}
            stats={initial.hadithStats}
            onToggle={(c) => toggleContent(setHadithEnabled, c)}
            onRowClick={(c) => openContentDialog("hadith", c)}
            defaultHint={t("defaultLockedHint")}
            chipLabel={(percent) => t("progressChipLabel", { percent })}
          />

          <SaveBar
            dirty={hadithDirty}
            pending={pending && pendingTab === "hadith"}
            onSave={() => save("hadith")}
            tCommon={tCommon}
            t={t}
          />
        </div>
      )}

      <ContentLangDialog
        key={`content:${contentDialogKind}:${contentDialogCode ?? "none"}`}
        open={contentDialogOpen}
        onOpenChange={setContentDialogOpen}
        kind={contentDialogKind}
        code={contentDialogCode}
        stats={
          contentDialogKind === "quran" ? initial.quranStats : initial.hadithStats
        }
        perCollection={
          contentDialogKind === "hadith" && contentDialogCode
            ? Object.entries(initial.hadithStats.perCollection)
                .map(([slug, { total, perLang }]) => ({
                  slug,
                  total,
                  translated: perLang[contentDialogCode] ?? 0,
                }))
                .sort((a, b) => a.slug.localeCompare(b.slug))
            : []
        }
        enabled={
          contentDialogCode != null &&
          (contentDialogKind === "quran"
            ? quranEnabled.has(contentDialogCode)
            : hadithEnabled.has(contentDialogCode))
        }
        onToggleEnabled={(code) =>
          toggleContent(
            contentDialogKind === "quran" ? setQuranEnabled : setHadithEnabled,
            code,
          )
        }
      />

      <ActivateLocaleDialog
        // Remount the dialog whenever the target locale changes so its
        // form state is reinitialised from props without a useEffect.
        key={`activate:${activatingCode ?? "none"}`}
        open={activateOpen}
        onOpenChange={setActivateOpen}
        code={activatingCode}
        initial={undefined}
        onSaved={onActivateSaved}
      />

      {editorTarget && editorBaseMessages && (
        <EditTranslationsDialog
          key={`editor:${editorCode ?? "none"}`}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          code={editorCode}
          nativeName={editorTarget.nativeName}
          baseMessages={editorBaseMessages}
          initialOverlay={(editorTarget.messages ?? {}) as MessageTree}
          rtl={editorTarget.rtl}
          readOnly={editorCode ? !editableSet.has(editorCode) : true}
          onSaved={onEditorSaved}
        />
      )}
    </div>
  );
}

function ProgressChip({
  percent,
  translated,
  total,
  label,
  onClick,
  disabled,
}: {
  percent: number;
  translated: number;
  total: number;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const tone =
    percent >= 95
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : percent >= 50
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${translated} / ${total}`}
      aria-label={label}
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums transition-opacity",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60",
        tone,
      ].join(" ")}
    >
      {percent}%
    </button>
  );
}

function ContentLangList({
  enabled,
  stats,
  onToggle,
  onRowClick,
  defaultHint,
  chipLabel,
}: {
  enabled: Set<LangCode>;
  stats: ContentStats;
  onToggle: (code: LangCode) => void;
  onRowClick: (code: LangCode) => void;
  defaultHint: string;
  chipLabel: (percent: number) => string;
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {ALL_LANGS.map((code) => {
        const isDefault = code === CONTENT_DEFAULT;
        const checked = enabled.has(code) || isDefault;
        // Arabic is the source — every doc has text_ar, so it's always 100%
        // by definition. The non-Arabic langs use the per-lang count over the
        // collection's total docs.
        const translated = isDefault ? stats.total : (stats.perLang[code] ?? 0);
        const percent =
          stats.total === 0 ? 0 : Math.round((translated / stats.total) * 100);
        return (
          <li
            key={code}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <button
              type="button"
              onClick={() => onRowClick(code)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="text-xl leading-none">
                {CONTENT_FLAGS[code] ?? "🌐"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {CONTENT_NATIVE[code] ?? code.toUpperCase()}
                </p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {code}
                  {isDefault ? ` · ${defaultHint}` : ""}
                </p>
              </div>
            </button>
            <ProgressChip
              percent={percent}
              translated={translated}
              total={stats.total}
              label={chipLabel(percent)}
              onClick={() => onRowClick(code)}
            />
            <ToggleSwitch
              checked={checked}
              disabled={isDefault}
              onChange={() => onToggle(code)}
              label={CONTENT_NATIVE[code] ?? code}
            />
          </li>
        );
      })}
    </ul>
  );
}

function SaveBar({
  dirty,
  pending,
  onSave,
  tCommon,
  t,
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  tCommon: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      {dirty && (
        <span className="text-xs text-muted-foreground">{t("unsavedChanges")}</span>
      )}
      <Button type="button" onClick={onSave} disabled={!dirty || pending} aria-busy={pending}>
        {pending ? tCommon("loading") : t("save")}
      </Button>
    </div>
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
      <ToggleSwitch checked={checked} disabled={isDefault} onChange={onToggle} label={native} />
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
        checked ? "bg-primary" : "bg-muted",
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

