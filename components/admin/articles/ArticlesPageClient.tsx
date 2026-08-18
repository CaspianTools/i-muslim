"use client";

import { Link } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/admin/RowActions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { openQuickCreate } from "@/components/admin/QuickCreate";
import { useCan } from "@/components/admin/PermissionsContext";
import { toast } from "@/components/ui/sonner";
import { cn, formatRelative } from "@/lib/utils";
import type {
  AdminArticleRow,
  ArticleCategoryDoc,
  CategorySlug,
} from "@/types/blog";
import { deleteArticle } from "@/app/[locale]/(admin)/admin/articles/_actions";

type StatusFilter = "all" | "draft" | "published";

export function ArticlesPageClient({
  initialItems,
  source,
  categories,
}: {
  initialItems: AdminArticleRow[];
  source: "firestore" | "mock";
  categories: ArticleCategoryDoc[];
}) {
  const categoryLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.slug, c.name.en);
    return (slug: string) => map.get(slug) ?? slug;
  }, [categories]);
  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategorySlug | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminArticleRow | null>(null);
  const [pending, startTransition] = useTransition();
  const canWrite = useCan("articles.write");
  const locale = useLocale();
  const tL = useTranslations("articlesAdmin.list");
  const tCommon = useTranslations("common");

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (categoryFilter !== "all" && row.category !== categoryFilter) return false;
      if (statusFilter !== "all") {
        const hasMatch = Object.values(row.translations).some(
          (t) => t?.status === statusFilter,
        );
        if (!hasMatch) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const titles = Object.values(row.translations)
          .map((t) => t?.title ?? "")
          .join(" ")
          .toLowerCase();
        if (!titles.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, statusFilter, categoryFilter]);

  function handleDelete() {
    if (!deleteTarget) return;
    if (source === "mock") {
      setItems((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast(tL("toastDeletedMock"));
      return;
    }
    const id = deleteTarget.id;
    const title = primaryTitle(deleteTarget, tL("untitled"));
    startTransition(async () => {
      try {
        await deleteArticle(id);
        setItems((prev) => prev.filter((r) => r.id !== id));
        toast.success(tL("toastDeleted", { title }));
      } catch (err) {
        toast.error(tL("toastDeleteFailed", { error: (err as Error).message }));
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={tL("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64"
          aria-label={tL("searchAria")}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label={tL("filterByStatus")}
        >
          <option value="all">{tL("allStatuses")}</option>
          <option value="draft">{tL("draft")}</option>
          <option value="published">{tL("published")}</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategorySlug | "all")}
          aria-label={tL("filterByCategory")}
        >
          <option value="all">{tL("allCategories")}</option>
          {categoryOptions.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name.en}</option>
          ))}
        </select>
        {canWrite && (
          <div className="ms-auto">
            <Button
              size="sm"
              onClick={() => openQuickCreate("article")}
              disabled={source === "mock"}
            >
              <Plus /> {tL("newArticle")}
            </Button>
          </div>
        )}
      </div>

      {source === "mock" && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          {tL("mockNotice")}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tL("colTitle")}</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tL("colCategory")}</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tL("colLocales")}</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tL("colUpdated")}</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">{tCommon("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  {tL("empty")}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const title = primaryTitle(row, tL("untitled"));
                return (
                  <tr key={row.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                    <td className="px-3 py-2 align-middle">
                      <Link
                        href={`/admin/articles/${row.id}`}
                        className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                      >
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="truncate">{title}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Badge variant="neutral">{categoryLabel(row.category)}</Badge>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-wrap gap-1">
                        {(["en", "ar", "tr", "id"] as const).map((loc) => {
                          const t = row.translations[loc];
                          if (!t) return null;
                          const variant =
                            t.status === "published" ? "success" : "warning";
                          return (
                            <Badge key={loc} variant={variant} className={cn("uppercase")}>
                              {loc}
                            </Badge>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-xs text-muted-foreground tabular-nums">
                      {formatRelative(row.updatedAt, locale)}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      {canWrite && (
                        <RowActions label={tCommon("actions")}>
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/articles/${row.id}`}>
                              <Pencil /> {tCommon("edit")}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="danger"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 /> {tCommon("delete")}
                          </DropdownMenuItem>
                        </RowActions>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={tL("deleteTitle")}
        description={
          deleteTarget
            ? tL("deleteDescription", {
                title: primaryTitle(deleteTarget, tL("untitled")),
              })
            : ""
        }
        confirmLabel={pending ? tL("deleting") : tCommon("delete")}
        confirmWord={
          deleteTarget ? primaryTitle(deleteTarget, tL("untitled")) : undefined
        }
        onConfirm={handleDelete}
      />
    </div>
  );
}

function primaryTitle(row: AdminArticleRow, untitled: string): string {
  return (
    row.translations.en?.title ||
    row.translations.ar?.title ||
    row.translations.tr?.title ||
    row.translations.id?.title ||
    untitled
  );
}
