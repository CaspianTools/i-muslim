"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ExternalLink,
  EyeOff,
  Flag,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/admin/RowActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { Link } from "@/i18n/navigation";
import { formatRelative } from "@/lib/utils";
import {
  setCommentStatusAction,
  dismissFlagsAction,
  deleteCommentHardAction,
} from "@/lib/admin/actions/comments";
import {
  COMMENT_ENTITY_TYPES,
  COMMENT_STATUSES,
  type CommentEntityType,
  type CommentRecord,
  type CommentStatus,
} from "@/types/comments";

interface Props {
  initialComments: CommentRecord[];
}

type StatusFilter = "all" | CommentStatus;
type EntityFilter = "all" | CommentEntityType;
type SortKey = "createdAt" | "flagCount";
type SortDir = "asc" | "desc";

function statusVariant(s: CommentStatus): "success" | "warning" | "danger" | "neutral" {
  if (s === "visible") return "success";
  if (s === "auto_hidden") return "warning";
  if (s === "hidden" || s === "deleted") return "danger";
  return "neutral";
}

const DEFAULT_SORT_DIR: SortDir = "desc";

function SortHeader({
  label,
  active,
  dir,
  onToggle,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onToggle: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      <span>{label}</span>
      <Icon className={`size-3 ${active ? "text-foreground" : "opacity-60"}`} />
    </button>
  );
}

export function CommentsClient({ initialComments }: Props) {
  const t = useTranslations("commentsAdmin");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("comments.statuses");
  const tEntities = useTranslations("commentsAdmin.entityTypes");
  const locale = useLocale();

  const [comments, setComments] = useState(initialComments);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewing, setViewing] = useState<CommentRecord | null>(null);
  const [deleting, setDeleting] = useState<CommentRecord | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = comments.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (entityFilter !== "all" && c.entityType !== entityFilter) return false;
      if (!q) return true;
      const author = (c.author.name ?? "").toLowerCase();
      const title = (c.itemMeta.title ?? "").toLowerCase();
      return (
        c.body.toLowerCase().includes(q) ||
        author.includes(q) ||
        title.includes(q) ||
        c.entityId.toLowerCase().includes(q)
      );
    });
    const sign = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortKey === "flagCount") {
        cmp = a.flagCount - b.flagCount;
      }
      if (cmp !== 0) return cmp * sign;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [comments, query, statusFilter, entityFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIR);
    }
  }

  async function changeStatus(id: string, next: CommentStatus) {
    const r = await setCommentStatusAction(id, next);
    if (!r.ok) return toast.error(r.error);
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, status: next } : c)));
    toast.success(t("statusUpdatedToast"));
  }

  async function dismissFlags(id: string) {
    const r = await dismissFlagsAction(id);
    if (!r.ok) return toast.error(r.error);
    setComments((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              flagCount: 0,
              status: c.status === "auto_hidden" ? "visible" : c.status,
            }
          : c,
      ),
    );
    toast.success(t("flagsDismissedToast"));
  }

  async function confirmDelete() {
    if (!deleting) return;
    const r = await deleteCommentHardAction(deleting.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== deleting.id));
    toast.success(t("deletedToast"));
    setDeleting(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-8 w-72"
            aria-label={t("search")}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label={t("filterByStatus")}
        >
          <option value="all">{t("statusAll")}</option>
          {COMMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tStatuses(s)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value as EntityFilter)}
          aria-label={t("filterByEntityType")}
        >
          <option value="all">{t("entityAll")}</option>
          {COMMENT_ENTITY_TYPES.map((e) => (
            <option key={e} value={e}>
              {tEntities(e)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {comments.length === 0 ? t("empty") : t("noResults")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t("columns.author")}</th>
                <th className="px-3 py-2">{t("columns.body")}</th>
                <th className="px-3 py-2">{t("columns.entity")}</th>
                <th className="px-3 py-2">{t("columns.status")}</th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.flags")}
                    active={sortKey === "flagCount"}
                    dir={sortDir}
                    onToggle={() => toggleSort("flagCount")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.created")}
                    active={sortKey === "createdAt"}
                    dir={sortDir}
                    onToggle={() => toggleSort("createdAt")}
                  />
                </th>
                <th className="px-3 py-2 text-end">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">
                      {c.author.name ?? t("anonymous")}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 max-w-md">
                    <button
                      type="button"
                      onClick={() => setViewing(c)}
                      className="text-left text-foreground hover:underline"
                    >
                      <p className="line-clamp-2 text-sm">{c.body || t("emptyBody")}</p>
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1 text-xs">
                      <Badge variant="neutral">{tEntities(c.entityType)}</Badge>
                      {c.itemMeta.href ? (
                        <Link
                          href={c.itemMeta.href}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3" />
                          <span className="truncate max-w-[180px]">{c.itemMeta.title}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{c.entityId}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(c.status)}>
                      {tStatuses(c.status)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {c.flagCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <Flag className="size-3" /> {c.flagCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {formatRelative(c.createdAt, locale)}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <RowActions label={tCommon("actions")}>
                      {c.status === "visible" ? (
                        <DropdownMenuItem onClick={() => changeStatus(c.id, "hidden")}>
                          <EyeOff /> {t("hide")}
                        </DropdownMenuItem>
                      ) : c.status === "auto_hidden" || c.status === "hidden" ? (
                        <DropdownMenuItem onClick={() => changeStatus(c.id, "visible")}>
                          <Check /> {t("restore")}
                        </DropdownMenuItem>
                      ) : null}
                      {c.flagCount > 0 && (
                        <DropdownMenuItem onClick={() => dismissFlags(c.id)}>
                          <RotateCcw /> {t("dismissFlags")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="danger" onClick={() => setDeleting(c)}>
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

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{t("viewDialogTitle", { name: viewing.author.name ?? t("anonymous") })}</DialogTitle>
                <DialogDescription>
                  {tEntities(viewing.entityType)} · {viewing.itemMeta.title} ·{" "}
                  {new Date(viewing.createdAt).toLocaleString(locale)}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground/90">
                {viewing.body || t("emptyBody")}
              </div>
              <DialogFooter>
                {viewing.itemMeta.href && (
                  <Button asChild variant="secondary">
                    <Link href={viewing.itemMeta.href}>
                      <ExternalLink className="size-4" /> {t("openSource")}
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setViewing(null)}>
                  {tCommon("close")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={tCommon("delete")}
        confirmWord="DELETE"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
