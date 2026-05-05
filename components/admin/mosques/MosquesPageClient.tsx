"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  ExternalLink,
  Eye,
  MoreHorizontal,
  Search,
  ShieldX,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { NewMosqueButton } from "@/components/admin/mosques/NewMosqueButton";
import {
  MosqueViewDialog,
  type MosqueViewSource,
} from "@/components/admin/mosques/MosqueViewDialog";
import { toast } from "sonner";
import { cn, formatRelative } from "@/lib/utils";
import type { Mosque, MosqueStatus } from "@/types/mosque";
import type { AdminMosqueRow } from "@/lib/admin/data/mosques";
import { deleteMosque, setMosqueStatus } from "@/app/[locale]/(admin)/admin/mosques/actions";
import { countryName } from "@/lib/mosques/countries";

const STATUS_VALUES = ["all", "draft", "pending_review", "published", "suspended"] as const;
const PAGE_SIZES = [10, 25, 50, 100];

type SortKey = "name" | "city" | "country" | "status" | "updatedAt";
type SortDir = "asc" | "desc";

function statusVariant(status: MosqueStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "pending_review") return "warning";
  if (status === "suspended") return "danger";
  return "neutral";
}

function rowKey(row: AdminMosqueRow): string {
  return row.kind === "mosque" ? `mosque:${row.mosque.slug}` : `submission:${row.submission.id}`;
}

function rowStatus(row: AdminMosqueRow): MosqueStatus {
  return row.kind === "mosque" ? row.mosque.status : "pending_review";
}

function rowUpdatedAt(row: AdminMosqueRow): string {
  return row.kind === "mosque" ? row.mosque.updatedAt : row.submission.createdAt;
}

function rowCity(row: AdminMosqueRow): string {
  return row.kind === "mosque" ? row.mosque.city : row.submission.payload.city;
}

function rowCountry(row: AdminMosqueRow): string {
  return row.kind === "mosque" ? row.mosque.country : row.submission.payload.country;
}

function rowName(row: AdminMosqueRow): { en: string; ar?: string } {
  const n = row.kind === "mosque" ? row.mosque.name : row.submission.payload.name;
  return { en: n.en, ar: n.ar };
}

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
      className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      <span>{label}</span>
      <Icon className={cn("size-3", active ? "text-foreground" : "opacity-60")} />
    </button>
  );
}

export function MosquesPageClient({
  initialRows,
}: {
  initialRows: AdminMosqueRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("mosquesAdmin");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("mosquesAdmin.statuses");
  const tActions = useTranslations("mosquesAdmin.form.actions");
  const tToast = useTranslations("mosquesAdmin.actions");
  const tDialog = useTranslations("mosquesAdmin.viewDialog");

  const rows = initialRows;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MosqueStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [deleteTarget, setDeleteTarget] = useState<Mosque | null>(null);

  // Auto-open the dialog if the user landed via a notification deep link
  // (?submission=<id>). Initialized once per mount; the URL param is stripped
  // by the effect below so refresh doesn't re-open after the user closes.
  const initialSubmissionId = searchParams.get("submission");
  const [viewSource, setViewSource] = useState<MosqueViewSource | null>(() => {
    if (!initialSubmissionId) return null;
    const match = initialRows.find(
      (r) => r.kind === "submission" && r.submission.id === initialSubmissionId,
    );
    return match?.kind === "submission" ? { kind: "submission", data: match.submission } : null;
  });
  useEffect(() => {
    if (initialSubmissionId) router.replace(pathname);
  }, [initialSubmissionId, pathname, router]);

  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      const s = rowStatus(r);
      if (status !== "all" && s !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        const n = rowName(r);
        if (
          !n.en.toLowerCase().includes(q) &&
          !rowCity(r).toLowerCase().includes(q) &&
          !rowCountry(r).toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
    const sign = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = rowName(a).en.localeCompare(rowName(b).en);
      else if (sortKey === "city") cmp = rowCity(a).localeCompare(rowCity(b));
      else if (sortKey === "country") {
        cmp = countryName(rowCountry(a)).localeCompare(countryName(rowCountry(b)));
      } else if (sortKey === "status") cmp = rowStatus(a).localeCompare(rowStatus(b));
      else if (sortKey === "updatedAt") {
        cmp = new Date(rowUpdatedAt(a)).getTime() - new Date(rowUpdatedAt(b)).getTime();
      }
      if (cmp !== 0) return cmp * sign;
      return new Date(rowUpdatedAt(b)).getTime() - new Date(rowUpdatedAt(a)).getTime();
    });
  }, [rows, query, status, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updatedAt" ? "desc" : "asc");
    }
  }

  const pageStart = pageIndex * pageSize;
  const visible = filtered.slice(pageStart, pageStart + pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  function callAction(name: string, fn: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(`${tToast("errorGeneric")} (${res.error ?? name})`);
        return;
      }
      onOk();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    callAction(
      "delete",
      () => deleteMosque(target.slug),
      () => {
        setDeleteTarget(null);
        toast.success(tToast("deletedToast", { name: target.name.en }));
      },
    );
  }

  function handleStatus(target: Mosque, next: MosqueStatus) {
    callAction(
      "status",
      () => setMosqueStatus(target.slug, next),
      () => {
        if (next === "published") toast.success(tToast("publishedToast", { name: target.name.en }));
        else if (next === "suspended") toast.success(tToast("suspendedToast", { name: target.name.en }));
        else toast.success(tToast("updatedToast", { name: target.name.en }));
      },
    );
  }

  function openRow(row: AdminMosqueRow) {
    if (row.kind === "submission") {
      setViewSource({ kind: "submission", data: row.submission });
    } else {
      router.push(`/admin/mosques/${row.mosque.slug}/edit`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPageIndex(0);
            }}
            className="ps-8 w-64"
            aria-label={t("search")}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as MosqueStatus | "all");
            setPageIndex(0);
          }}
          aria-label={t("filterByStatus")}
        >
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {tStatuses(v)}
            </option>
          ))}
        </select>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/admin/mosques/import">
              <Upload /> {t("importCta")}
            </Link>
          </Button>
          <NewMosqueButton label={t("newMosque")} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.name")}
                    active={sortKey === "name"}
                    dir={sortDir}
                    onToggle={() => toggleSort("name")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.city")}
                    active={sortKey === "city"}
                    dir={sortDir}
                    onToggle={() => toggleSort("city")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.country")}
                    active={sortKey === "country"}
                    dir={sortDir}
                    onToggle={() => toggleSort("country")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.status")}
                    active={sortKey === "status"}
                    dir={sortDir}
                    onToggle={() => toggleSort("status")}
                  />
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("columns.type")}
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("columns.updatedAt")}
                    active={sortKey === "updatedAt"}
                    dir={sortDir}
                    onToggle={() => toggleSort("updatedAt")}
                  />
                </th>
                <th className="px-3 py-2 w-12" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                visible.map((row) => {
                  const name = rowName(row);
                  const city = rowCity(row);
                  const country = rowCountry(row);
                  const s = rowStatus(row);
                  return (
                    <tr
                      key={rowKey(row)}
                      className={cn(
                        "border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer",
                      )}
                      onClick={() => openRow(row)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{name.en}</div>
                        {name.ar && (
                          <div dir="rtl" lang="ar" className="font-arabic text-sm text-muted-foreground">
                            {name.ar}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{city}</td>
                      <td className="px-3 py-2 text-muted-foreground">{countryName(country)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={statusVariant(s)}>{tStatuses(s)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={row.kind === "submission" ? "warning" : "neutral"}>
                          {row.kind === "submission" ? tDialog("badgeSubmission") : tDialog("badgeMosque")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {formatRelative(rowUpdatedAt(row))}
                      </td>
                      <td className="px-3 py-2 text-end" onClick={(e) => e.stopPropagation()}>
                        {row.kind === "mosque" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Actions for ${name.en}`}>
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/admin/mosques/${row.mosque.slug}/edit`}>
                                  <Edit /> {tCommon("edit")}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/mosques/${row.mosque.slug}`} target="_blank" rel="noopener noreferrer">
                                  <Eye /> View public page <ExternalLink className="ms-auto size-3" />
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {row.mosque.status !== "published" && (
                                <DropdownMenuItem onClick={() => handleStatus(row.mosque, "published")}>
                                  <Upload /> {tActions("publish")}
                                </DropdownMenuItem>
                              )}
                              {row.mosque.status === "published" && (
                                <DropdownMenuItem onClick={() => handleStatus(row.mosque, "draft")}>
                                  {tActions("unpublish")}
                                </DropdownMenuItem>
                              )}
                              {row.mosque.status !== "suspended" && (
                                <DropdownMenuItem onClick={() => handleStatus(row.mosque, "suspended")}>
                                  <ShieldX /> {tActions("suspend")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="danger" onClick={() => setDeleteTarget(row.mosque)}>
                                <Trash2 /> {tCommon("delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page</span>
            <select
              className="h-7 rounded-md border border-input bg-background px-1"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground tabular-nums">
            <span>
              {filtered.length === 0
                ? "0"
                : `${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next"
              disabled={pageIndex >= pageCount - 1}
              onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={deleteTarget ? t("deleteDescription", { name: deleteTarget.name.en }) : ""}
        confirmLabel={tCommon("delete")}
        confirmWord={deleteTarget?.name.en}
        onConfirm={handleDelete}
      />

      <MosqueViewDialog
        open={Boolean(viewSource)}
        onOpenChange={(next) => !next && setViewSource(null)}
        source={viewSource}
      />
    </div>
  );
}
