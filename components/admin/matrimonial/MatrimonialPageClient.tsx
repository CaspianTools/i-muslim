"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  MoreHorizontal,
  Search,
  ShieldCheck,
  ShieldX,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { cn, formatRelative, initials } from "@/lib/utils";
import { ageFromDob } from "@/lib/matrimonial/age";
import {
  bulkDelete,
  bulkSetStatus,
} from "@/app/(admin)/admin/matrimonial/actions";
import { ProfileDetailDrawer } from "./ProfileDetailDrawer";
import { ReportsTable } from "./ReportsTable";
import { StatsTab } from "./StatsTab";
import type {
  Gender,
  Madhhab,
  MatrimonialProfile,
  MatrimonialReport,
  MatrimonialStats,
  ProfileStatus,
} from "@/types/matrimonial";

const PAGE_SIZES = [10, 25, 50, 100];
const STATUS_VALUES: Array<ProfileStatus | "all"> = ["all", "draft", "pending", "active", "suspended", "hidden"];
const GENDER_VALUES: Array<Gender | "all"> = ["all", "male", "female"];
const MADHHAB_VALUES: Array<Madhhab | "all"> = ["all", "hanafi", "maliki", "shafii", "hanbali", "other", "none"];

function statusVariant(s: ProfileStatus): "success" | "warning" | "danger" | "neutral" {
  if (s === "active") return "success";
  if (s === "pending") return "warning";
  if (s === "suspended") return "danger";
  return "neutral";
}

interface Props {
  initialProfiles: MatrimonialProfile[];
  initialReports: MatrimonialReport[];
  stats: MatrimonialStats;
  source: "firestore" | "mock";
}

export function MatrimonialPageClient({ initialProfiles, initialReports, stats, source }: Props) {
  const t = useTranslations("matrimonial.admin");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("matrimonial.statuses");
  const tGenders = useTranslations("matrimonial.genders");
  const tMadhhabs = useTranslations("matrimonial.madhhabs");

  const [profiles, setProfiles] = useState(initialProfiles);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<Gender | "all">("all");
  const [status, setStatus] = useState<ProfileStatus | "all">("all");
  const [madhhab, setMadhhab] = useState<Madhhab | "all">("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<MatrimonialProfile | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const profilesById = useMemo(() => {
    const m: Record<string, MatrimonialProfile> = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  const bulkApply = useCallback(
    (ids: string[], next: ProfileStatus) => {
      startTransition(async () => {
        await bulkSetStatus(ids, next);
        setProfiles((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, status: next } : p)));
        setRowSelection({});
        toast.success(
          ids.length === 1
            ? t(next === "active" ? "approved" : next === "suspended" ? "suspended" : "hidden", {
                name: profilesById[ids[0]!]?.displayName ?? "",
              })
            : t("selectedCount", { count: ids.length }),
        );
      });
    },
    [profilesById, t],
  );

  const filtered = useMemo(() => {
    return profiles.filter((p) => {
      if (gender !== "all" && p.gender !== gender) return false;
      if (status !== "all" && p.status !== status) return false;
      if (madhhab !== "all" && p.madhhab !== madhhab) return false;
      if (verifiedOnly && !p.verification.emailVerified) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.displayName.toLowerCase().includes(q) &&
          !p.city.toLowerCase().includes(q) &&
          !p.country.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [profiles, query, gender, status, madhhab, verifiedOnly]);

  const columns = useMemo<ColumnDef<MatrimonialProfile>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label={t("selectAll")}
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={t("selectRow", { name: row.original.displayName })}
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        size: 32,
      },
      {
        id: "profile",
        accessorFn: (p) => p.displayName,
        header: t("columns.profile"),
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback>{initials(p.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                  <span className="truncate">{p.displayName}</span>
                  {p.verification.emailVerified && (
                    <BadgeCheck className="size-3.5 text-primary shrink-0" />
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {ageFromDob(p.dateOfBirth)} · {p.city}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "gender",
        accessorKey: "gender",
        header: t("columns.gender"),
        cell: ({ row }) => (
          <Badge variant="neutral">{tGenders(row.original.gender)}</Badge>
        ),
      },
      {
        id: "country",
        accessorKey: "country",
        header: t("columns.country"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.country}</span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>
            {tStatuses(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "joined",
        accessorFn: (p) => new Date(p.createdAt).getTime(),
        header: t("columns.joined"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatRelative(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()} className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("rowActions", { name: p.displayName })}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDetail(p)}>{tCommon("edit")}</DropdownMenuItem>
                  {p.status !== "active" && (
                    <DropdownMenuItem
                      onClick={() => bulkApply([p.id], "active")}
                    >
                      <ShieldCheck /> {t("approve")}
                    </DropdownMenuItem>
                  )}
                  {p.status !== "suspended" && (
                    <DropdownMenuItem onClick={() => bulkApply([p.id], "suspended")}>
                      <ShieldX /> {t("suspend")}
                    </DropdownMenuItem>
                  )}
                  {p.status !== "hidden" && (
                    <DropdownMenuItem onClick={() => bulkApply([p.id], "hidden")}>
                      <EyeOff /> {t("hide")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="danger" onClick={() => setDetail(p)}>
                    <Trash2 /> {tCommon("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
        size: 48,
      },
    ],
    [t, tCommon, tGenders, tStatuses, bulkApply],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedIds.length;

  function handleBulkDelete() {
    const ids = [...selectedIds];
    startTransition(async () => {
      await bulkDelete(ids);
      setProfiles((prev) => prev.filter((p) => !ids.includes(p.id)));
      setRowSelection({});
      setBulkDeleteOpen(false);
      toast.success(t("selectedCount", { count: ids.length }));
    });
  }

  function exportCsv(rows: MatrimonialProfile[]) {
    const header = ["id", "displayName", "gender", "age", "country", "city", "status", "verified", "createdAt"];
    const lines = [header.join(",")];
    for (const p of rows) {
      lines.push(
        [
          p.id,
          p.displayName,
          p.gender,
          ageFromDob(p.dateOfBirth),
          p.country,
          p.city,
          p.status,
          p.verification.emailVerified,
          p.createdAt,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matrimonial-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Tabs defaultValue="profiles" className="space-y-4">
      <TabsList>
        <TabsTrigger value="profiles">{t("tabs.profiles")}</TabsTrigger>
        <TabsTrigger value="reports">{t("tabs.reports")}</TabsTrigger>
        <TabsTrigger value="stats">{t("tabs.stats")}</TabsTrigger>
      </TabsList>

      <TabsContent value="profiles" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ps-8 w-64"
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "all")}
            aria-label={t("filterByGender")}
          >
            {GENDER_VALUES.map((v) => (
              <option key={v} value={v}>{tGenders(v)}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as ProfileStatus | "all")}
            aria-label={t("filterByStatus")}
          >
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>{tStatuses(v)}</option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={madhhab}
            onChange={(e) => setMadhhab(e.target.value as Madhhab | "all")}
            aria-label={t("filterByMadhhab")}
          >
            {MADHHAB_VALUES.map((v) => (
              <option key={v} value={v}>{tMadhhabs(v)}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={verifiedOnly}
              onCheckedChange={(v) => setVerifiedOnly(Boolean(v))}
            />
            {t("verifiedOnly")}
          </label>
          <div className="ms-auto">
            <Button variant="secondary" size="sm" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
              <Download /> {t("exportCsv")}
            </Button>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium">{t("selectedCount", { count: selectedCount })}</span>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => bulkApply(selectedIds, "active")}>
                <ShieldCheck /> {t("approve")}
              </Button>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => bulkApply(selectedIds, "suspended")}>
                <ShieldX /> {t("suspend")}
              </Button>
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => bulkApply(selectedIds, "hidden")}>
                <EyeOff /> {t("hide")}
              </Button>
              <Button variant="danger" size="sm" disabled={pending} onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 /> {tCommon("delete")}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-border bg-muted/40 text-left">
                    {hg.headers.map((h) => {
                      const canSort = h.column.getCanSort();
                      const sortState = h.column.getIsSorted();
                      return (
                        <th
                          key={h.id}
                          scope="col"
                          className={cn(
                            "px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground",
                            canSort && "cursor-pointer select-none",
                          )}
                          onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                          style={{ width: h.getSize() ? h.getSize() : undefined }}
                        >
                          <span className="inline-flex items-center gap-1">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {canSort && (
                              <span className="text-muted-foreground/70">
                                {sortState === "asc" ? (
                                  <ArrowUp className="size-3" />
                                ) : sortState === "desc" ? (
                                  <ArrowDown className="size-3" />
                                ) : (
                                  <ArrowUpDown className="size-3" />
                                )}
                              </span>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                      {t("noResults")}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const selected = row.getIsSelected();
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer",
                          selected && "bg-primary/5",
                        )}
                        onClick={() => setDetail(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-2 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{t("rowsPerPage")}</span>
              <select
                className="h-7 rounded-md border border-input bg-background px-1"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPageIndex(0);
                }}
                aria-label={t("rowsPerPage")}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground tabular-nums">
              <span>
                {table.getRowModel().rows.length === 0
                  ? t("rangeOf", { start: 0, end: 0, total: 0 })
                  : t("rangeOf", {
                      start: pageIndex * pageSize + 1,
                      end: Math.min((pageIndex + 1) * pageSize, filtered.length),
                      total: filtered.length,
                    })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("previousPage")}
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft className="size-4 rtl:rotate-180" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("nextPage")}
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="reports">
        <ReportsTable reports={initialReports} profilesById={profilesById} />
      </TabsContent>

      <TabsContent value="stats">
        <StatsTab stats={stats} />
      </TabsContent>

      <ProfileDetailDrawer
        profile={detail}
        onOpenChange={(open) => !open && setDetail(null)}
        onUpdate={(updated) => {
          setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          setDetail(updated);
        }}
        onDelete={(id) => {
          setProfiles((prev) => prev.filter((p) => p.id !== id));
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={tCommon("delete")}
        description={t("selectedCount", { count: selectedCount })}
        confirmLabel={tCommon("delete")}
        confirmWord={String(selectedCount)}
        onConfirm={handleBulkDelete}
      />

      <input type="hidden" data-source={source} />
    </Tabs>
  );
}
