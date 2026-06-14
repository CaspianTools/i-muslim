"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/components/ui/sonner";
import { deleteArticleCategoryAction } from "@/lib/admin/actions/article-categories";
import { ArticleCategoryForm } from "./ArticleCategoryForm";
import type { ArticleCategoryDoc } from "@/types/blog";

interface Props {
  initialCategories: ArticleCategoryDoc[];
  canPersist: boolean;
}

export function CategoriesClient({ initialCategories, canPersist }: Props) {
  const [items, setItems] = useState(initialCategories);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ArticleCategoryDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArticleCategoryDoc | null>(null);

  function openEdit(c: ArticleCategoryDoc) {
    setEditing(c);
    setOpen(true);
  }

  function handleSaved(saved: ArticleCategoryDoc) {
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
      toast.error("Firebase Admin is not configured.");
      return;
    }
    const r = await deleteArticleCategoryAction(target.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== target.id));
    toast.success("Category deleted.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => openQuickCreate("articleCategory")}
          disabled={!canPersist}
        >
          <Plus className="size-4" /> Add category
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No categories yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name (EN)</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Sort</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...items]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2.5 font-medium">{c.name.en}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.slug}</td>
                    <td className="px-3 py-2.5 tabular-nums">{c.sortOrder}</td>
                    <td className="px-3 py-2.5">
                      {c.isActive ? <Badge variant="success">●</Badge> : <Badge>—</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <RowActions label="Actions">
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="danger" onClick={() => setDeleteTarget(c)}>
                          <Trash2 /> Delete
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
            <EditorDialogTitle>Edit category</EditorDialogTitle>
            <p className="text-sm text-muted-foreground">
              Localized labels for the article category. The slug is used in URLs and stored on each article.
            </p>
          </EditorDialogHeader>
          <ArticleCategoryForm
            category={editing}
            canPersist={canPersist}
            onSaved={handleSaved}
            onCancel={() => setOpen(false)}
          />
        </EditorDialogContent>
      </EditorDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete category"
        description={
          deleteTarget
            ? `This permanently deletes "${deleteTarget.name.en}". Articles still using this slug will keep it as a string but will no longer match a known category. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        confirmWord={deleteTarget?.slug}
        onConfirm={handleDelete}
      />
    </div>
  );
}
