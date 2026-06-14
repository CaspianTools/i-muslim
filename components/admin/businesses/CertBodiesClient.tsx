"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/admin/RowActions";
import { countryName } from "@/lib/mosques/countries";
import {
  EditorDialog,
  EditorDialogContent,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { openQuickCreate } from "@/components/admin/QuickCreate";
import { toast } from "@/components/ui/sonner";
import { deleteCertBodyAction } from "@/lib/admin/actions/business-taxonomies";
import { CertBodyForm } from "./CertBodyForm";
import type { BusinessCertificationBody } from "@/types/business";

interface Props {
  initialCertBodies: BusinessCertificationBody[];
  canPersist: boolean;
}

export function CertBodiesClient({ initialCertBodies, canPersist }: Props) {
  const t = useTranslations("businesses.admin");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState(initialCertBodies);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessCertificationBody | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessCertificationBody | null>(null);

  function openEdit(c: BusinessCertificationBody) {
    setEditing(c);
    setOpen(true);
  }

  function handleSaved(saved: BusinessCertificationBody) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setOpen(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await deleteCertBodyAction(target.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== target.id));
    toast.success(t("taxonomyDeletedToast"));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => openQuickCreate("businessCertBody")}
          disabled={!canPersist}
        >
          <Plus className="size-4" /> {t("taxonomyAddCta")}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("taxonomyEmpty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">{t("slug")}</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">{t("verifiedByPlatformLabel")}</th>
                <th className="px-3 py-2 text-end">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-medium">{c.name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.slug}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground me-1.5">{c.country}</span>
                    {countryName(c.country)}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.verifiedByPlatform ? <Badge variant="info">●</Badge> : <Badge>—</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <RowActions label={tCommon("actions")}>
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        <Pencil /> {tCommon("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="danger" onClick={() => setDeleteTarget(c)}>
                        <Trash2 /> {tCommon("delete")}
                      </DropdownMenuItem>
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditorDialog open={open} onOpenChange={setOpen}>
        <EditorDialogContent>
          <EditorDialogHeader>
            <EditorDialogTitle>{t("taxonomyEditCta")}</EditorDialogTitle>
          </EditorDialogHeader>
          <CertBodyForm
            certBody={editing}
            canPersist={canPersist}
            onSaved={handleSaved}
            onCancel={() => setOpen(false)}
          />
        </EditorDialogContent>
      </EditorDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("taxonomyDeleteTitle")}
        description={t("taxonomyDeleteDescription", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("taxonomyDeleteCta")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
