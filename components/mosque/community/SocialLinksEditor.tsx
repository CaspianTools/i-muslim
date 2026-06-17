"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link2, Loader2, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMosqueSocial } from "@/app/[locale]/(site)/mosques/manage-actions";
import { SOCIAL_PLATFORMS, type MosqueSocial, type SocialPlatform } from "@/types/mosque";
import { SOCIAL_LABELS } from "@/lib/mosques/social";

interface Row {
  platform: SocialPlatform;
  value: string;
}

export function SocialLinksEditor({ slug, initial }: { slug: string; initial?: MosqueSocial }) {
  const t = useTranslations("mosques.manage");
  const [rows, setRows] = useState<Row[]>(() =>
    SOCIAL_PLATFORMS.filter((p) => initial?.[p]).map((p) => ({ platform: p, value: initial![p]! })),
  );
  const [busy, setBusy] = useState(false);

  const used = new Set(rows.map((r) => r.platform));

  function addRow() {
    const next = SOCIAL_PLATFORMS.find((p) => !used.has(p));
    if (next) setRows((r) => [...r, { platform: next, value: "" }]);
  }
  function setRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    const social: MosqueSocial = {};
    for (const r of rows) {
      const v = r.value.trim();
      if (v) social[r.platform] = v;
    }
    try {
      const res = await updateMosqueSocial(slug, social);
      if (!res.ok) toast.error(t("saveFailed"));
      else toast.success(t("saved"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("social")}</Label>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={addRow}
          disabled={rows.length >= SOCIAL_PLATFORMS.length}
        >
          <Plus className="size-4" /> {t("addLink")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("socialEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const options = SOCIAL_PLATFORMS.filter((p) => p === row.platform || !used.has(p));
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                  <Link2 className="size-4" />
                </span>
                <select
                  value={row.platform}
                  onChange={(e) => setRow(i, { platform: e.target.value as SocialPlatform })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-accent"
                >
                  {options.map((p) => (
                    <option key={p} value={p}>
                      {SOCIAL_LABELS[p]}
                    </option>
                  ))}
                </select>
                <Input
                  value={row.value}
                  onChange={(e) => setRow(i, { value: e.target.value })}
                  placeholder={t("socialPlaceholder")}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="grid size-9 shrink-0 place-items-center rounded-md bg-danger text-danger-foreground transition-opacity hover:opacity-90"
                  aria-label={t("removeLink")}
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Button variant="secondary" size="sm" onClick={save} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {t("save")}
      </Button>
    </div>
  );
}
