"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/admin/RowActions";
import {
  EditorDialog,
  EditorDialogContent,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { openQuickCreate } from "@/components/admin/QuickCreate";
import { useCanCreate } from "@/components/admin/PermissionsContext";
import { toast } from "@/components/ui/sonner";
import { deleteAmenityAction } from "@/lib/admin/actions/business-taxonomies";
import { BusinessAmenityForm } from "./BusinessAmenityForm";
import type { BusinessAmenity } from "@/types/business";

interface Props {
  initialAmenities: BusinessAmenity[];
  canPersist: boolean;
}

export function AmenitiesClient({ initialAmenities, canPersist }: Props) {
  const t = useTranslations("businesses.admin");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState(initialAmenities);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessAmenity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessAmenity | null>(null);
  const canCreate = useCanCreate("businessAmenity");

  function openEdit(a: BusinessAmenity) {
    setEditing(a);
    setOpen(true);
  }

  function handleSaved(saved: BusinessAmenity) {
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
    const r = await deleteAmenityAction(target.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== target.id));
    toast.success(t("taxonomyDeletedToast"));
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button
            onClick={() => openQuickCreate("businessAmenity")}
            disabled={!canPersist}
          >
            <Plus className="size-4" /> {t("taxonomyAddCta")}
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("taxonomyEmpty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("nameLocale", { locale: "EN" })}</th>
                <th className="px-3 py-2">{t("slug")}</th>
                <th className="px-3 py-2">{t("iconKey")}</th>
                <th className="px-3 py-2 text-end">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-medium">{a.name.en}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{a.slug}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.iconKey ?? "—"}</td>
                  <td className="px-3 py-2.5 text-end">
                    <RowActions label={tCommon("actions")}>
                      <DropdownMenuItem onClick={() => openEdit(a)}>
                        <Pencil /> {tCommon("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="danger" onClick={() => setDeleteTarget(a)}>
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
          <BusinessAmenityForm
            amenity={editing}
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
        description={t("taxonomyDeleteDescription", { name: deleteTarget?.name.en ?? "" })}
        confirmLabel={t("taxonomyDeleteCta")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
