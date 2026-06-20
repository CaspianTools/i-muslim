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
import { useCan } from "@/components/admin/PermissionsContext";
import { toast } from "sonner";
import { deleteMosqueFacilityAction } from "@/lib/admin/actions/mosque-facilities";
import { MosqueFacilityForm } from "./MosqueFacilityForm";
import type { MosqueFacility } from "@/types/mosque";

interface Props {
  initialFacilities: MosqueFacility[];
  canPersist: boolean;
}

export function FacilitiesClient({ initialFacilities, canPersist }: Props) {
  const t = useTranslations("mosquesAdmin.facilities");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState(initialFacilities);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MosqueFacility | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MosqueFacility | null>(null);
  const canWrite = useCan("mosques.write");

  function openEdit(f: MosqueFacility) {
    setEditing(f);
    setOpen(true);
  }

  function handleSaved(saved: MosqueFacility) {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.id === saved.id);
      if (idx === -1) return [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder);
      const next = [...prev];
      next[idx] = saved;
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
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
    const r = await deleteMosqueFacilityAction(target.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== target.id));
    toast.success(t("deletedToast"));
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={() => openQuickCreate("mosqueFacility")} disabled={!canPersist}>
            <Plus className="size-4" /> {t("addCta")}
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("name")}</th>
                <th className="px-3 py-2">{t("slug")}</th>
                <th className="px-3 py-2">{t("iconKey")}</th>
                <th className="px-3 py-2">{t("sortOrder")}</th>
                <th className="px-3 py-2 text-end">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-medium">{f.name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{f.slug}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{f.iconKey ?? "—"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-muted-foreground">
                    {f.sortOrder}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    {canWrite && (
                      <RowActions label={tCommon("actions")}>
                        <DropdownMenuItem onClick={() => openEdit(f)}>
                          <Pencil /> {tCommon("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="danger" onClick={() => setDeleteTarget(f)}>
                          <Trash2 /> {tCommon("delete")}
                        </DropdownMenuItem>
                      </RowActions>
                    )}
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
            <EditorDialogTitle>{t("editTitle")}</EditorDialogTitle>
          </EditorDialogHeader>
          <MosqueFacilityForm
            facility={editing}
            canPersist={canPersist}
            onSaved={handleSaved}
            onCancel={() => setOpen(false)}
          />
        </EditorDialogContent>
      </EditorDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("deleteCta")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
