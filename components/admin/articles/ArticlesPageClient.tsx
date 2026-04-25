"use client";

import { Link } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { cn, formatRelative } from "@/lib/utils";
import type { AdminArticleRow, CategorySlug } from "@/types/blog";
import { CATEGORY_SLUGS } from "@/lib/blog/taxonomy";
import { deleteArticle } from "@/app/[locale]/(admin)/admin/articles/_actions";

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  "prayer-times": "Prayer Times",
  hijri: "Hijri",
  "quran-hadith": "Quran & Hadith",
  qibla: "Qibla",
};

type StatusFilter = "all" | "draft" | "published";

export function ArticlesPageClient({
  initialItems,
  source,
}: {
  initialItems: AdminArticleRow[];
  source: "firestore" | "mock";
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategorySlug | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminArticleRow | null>(null);
  const [pending, startTransition] = useTransition();

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
      toast(`Deleted (mock) — Firebase not configured.`);
      return;
    }
    const id = deleteTarget.id;
    const title = primaryTitle(deleteTarget);
    startTransition(async () => {
      try {
        await deleteArticle(id);
        setItems((prev) => prev.filter((r) => r.id !== id));
        toast.success(`Deleted "${title}".`);
      } catch (err) {
        toast.error(`Failed to delete: ${(err as Error).message}`);
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-64"
          aria-label="Search articles"
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategorySlug | "all")}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {CATEGORY_SLUGS.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <div className="ms-auto">
          <Button asChild size="sm" disabled={source === "mock"}>
            <Link href="/admin/articles/new">
              <Plus /> New article
            </Link>
          </Button>
        </div>
      </div>

      {source === "mock" && (
        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          Configure Firebase Admin to create and edit articles. Listing shows sample data.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Locales</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Updated</th>
              <th scope="col" className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No articles match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const title = primaryTitle(row);
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
                      <Badge variant="neutral">{CATEGORY_LABELS[row.category]}</Badge>
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
                      {formatRelative(row.updatedAt)}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(row)}
                        aria-label={`Delete ${title}`}
                      >
                        <Trash2 className="size-4 text-danger" />
                      </Button>
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
        title="Delete article"
        description={
          deleteTarget
            ? `This permanently deletes "${primaryTitle(deleteTarget)}" and all its translations. This cannot be undone.`
            : ""
        }
        confirmLabel={pending ? "Deleting…" : "Delete"}
        confirmWord={deleteTarget ? primaryTitle(deleteTarget) : undefined}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function primaryTitle(row: AdminArticleRow): string {
  return (
    row.translations.en?.title ||
    row.translations.ar?.title ||
    row.translations.tr?.title ||
    row.translations.id?.title ||
    "Untitled"
  );
}
