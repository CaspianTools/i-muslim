"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { type Locale } from "@/i18n/config";
import { updateUiLocaleMessagesAction } from "@/app/[locale]/(admin)/admin/settings/_actions";
import {
  flattenLeaves,
  setLeafByPath,
  type MessageTree,
  type Leaf,
} from "@/lib/i18n/translation-stats";

export type EditTranslationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: Locale | null;
  nativeName: string;
  // The base locale's bundled messages — what each input shows as the
  // English-side reference and what we treat as "untranslated" (overlay
  // value === base value).
  baseMessages: MessageTree;
  // The activated locale's current overlay (post-sync, mirrors base shape).
  initialOverlay: MessageTree;
  rtl: boolean;
  onSaved: (newOverlay: MessageTree, percent: number) => void;
};

type Row = { key: string; baseValue: Leaf; overlayValue: Leaf };

function asString(v: Leaf): string {
  if (v == null) return "";
  return String(v);
}

export function EditTranslationsDialog({
  open,
  onOpenChange,
  code,
  nativeName,
  baseMessages,
  initialOverlay,
  rtl,
  onSaved,
}: EditTranslationsDialogProps) {
  const t = useTranslations("adminSettings.languages.editor");
  const tCommon = useTranslations("common");

  // Pre-flatten base. Stays stable across re-renders since baseMessages is a
  // module-scope import on the server side.
  const baseRows = useMemo(() => flattenLeaves(baseMessages), [baseMessages]);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [showOnlyUntranslated, setShowOnlyUntranslated] = useState(false);
  const [pending, startTransition] = useTransition();

  // Compose the current overlay = initialOverlay + edits.
  const rows: Row[] = useMemo(() => {
    return baseRows.map(({ key, value }) => {
      const overlayValue = key in edits ? edits[key]! : getLeaf(initialOverlay, key) ?? value;
      return { key, baseValue: value, overlayValue };
    });
  }, [baseRows, initialOverlay, edits]);

  const liveStats = useMemo(() => {
    let translated = 0;
    for (const r of rows) {
      if (r.overlayValue !== r.baseValue) translated++;
    }
    const total = rows.length;
    const percent = total === 0 ? 0 : Math.round((translated / total) * 100);
    return { total, translated, percent };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (showOnlyUntranslated && r.overlayValue !== r.baseValue) return false;
      if (!needle) return true;
      return (
        r.key.toLowerCase().includes(needle) ||
        asString(r.baseValue).toLowerCase().includes(needle) ||
        asString(r.overlayValue).toLowerCase().includes(needle)
      );
    });
  }, [rows, filter, showOnlyUntranslated]);

  const dirty = Object.keys(edits).length > 0;

  function onEdit(key: string, value: string) {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }

  function onSave() {
    if (!code || !dirty) return;
    // Build the new overlay by merging `edits` into a copy of the initial.
    const next: MessageTree = JSON.parse(JSON.stringify(initialOverlay));
    for (const [key, val] of Object.entries(edits)) {
      setLeafByPath(next, key, val);
    }
    startTransition(async () => {
      const res = await updateUiLocaleMessagesAction({ code, messages: next });
      if (res.ok) {
        setEdits({});
        toast.success(t("savedToast"));
        onSaved(next, liveStats.percent);
      } else {
        toast.error(t("errorToast"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t("title")}{code ? ` — ${nativeName} (${code.toUpperCase()})` : ""}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-8"
              disabled={pending}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showOnlyUntranslated}
              onChange={(e) => setShowOnlyUntranslated(e.target.checked)}
              disabled={pending}
            />
            <span>{t("untranslatedOnly")}</span>
          </label>
          <span className="text-xs text-muted-foreground">
            {t("progress", {
              percent: liveStats.percent,
              translated: liveStats.translated,
              total: liveStats.total,
            })}
          </span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <ul className="space-y-3 py-2">
            {visibleRows.length === 0 ? (
              <li className="px-1 text-sm text-muted-foreground">{t("noMatches")}</li>
            ) : (
              visibleRows.map(({ key, baseValue, overlayValue }) => {
                const overlayStr = asString(overlayValue);
                const isUntranslated = overlayValue === baseValue;
                return (
                  <li
                    key={key}
                    className="grid gap-1 rounded-md border border-border bg-card p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <code className="text-[11px] text-muted-foreground">{key}</code>
                      {isUntranslated && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("untranslated")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {asString(baseValue)}
                    </p>
                    <Input
                      value={overlayStr}
                      onChange={(e) => onEdit(key, e.target.value)}
                      disabled={pending}
                      dir={rtl ? "rtl" : "ltr"}
                      lang={code ?? undefined}
                      className="font-normal"
                    />
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tCommon("close")}
          </Button>
          <Button type="button" onClick={onSave} disabled={!dirty || pending} aria-busy={pending}>
            {pending
              ? tCommon("loading")
              : dirty
                ? t("saveChanges", { count: Object.keys(edits).length })
                : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny wrapper around getLeafByPath that returns string-coerced leaves; the
// editor surfaces values as strings only.
function getLeaf(tree: MessageTree, key: string): string | undefined {
  const segments = key.split(".");
  let cursor: unknown = tree;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
    if (cursor === undefined) return undefined;
  }
  if (cursor == null) return undefined;
  if (typeof cursor === "object") return undefined;
  return String(cursor);
}
