"use client";

import { useMemo, useState, useTransition } from "react";
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
import { ArrowDown, ArrowUp, ArrowUpDown, BadgeCheck, ChevronLeft, ChevronRight, Download, Mail, MoreHorizontal, Plus, Search, ShieldX, Trash2, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SearchableMultiCombobox,
  type SearchableMultiComboboxOption,
} from "@/components/common/SearchableMultiCombobox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { cn, formatRelative, initials } from "@/lib/utils";
import type { AdminUser, AdminRole, AdminUserStatus } from "@/types/admin";
import type { AdminRoleDoc } from "@/lib/admin/data/roles";
import { WILDCARD } from "@/lib/permissions/catalog";
import { ALL_LANGS, LANG_LABELS } from "@/lib/translations";
import { InviteUserDrawer } from "./InviteUserDrawer";

const PAGE_SIZES = [10, 25, 50, 100];

const STATUS_VALUES = ["all", "active", "pending", "suspended", "banned"] as const;

const ASSIGNABLE_LANGS = ALL_LANGS.filter((l) => l !== "ar");

function roleVariant(role: string): "accent" | "info" | "success" | "neutral" {
  if (role === "keymaster" || role === "admin") return "accent";
  if (role === "moderator") return "info";
  if (role === "scholar" || role === "translator" || role.startsWith("translator-")) {
    return "success";
  }
  return "neutral";
}

function roleHasTranslate(role: AdminRoleDoc | undefined): boolean {
  if (!role) return false;
  if (role.permissions === WILDCARD) return false;
  return role.permissions.some((p) => p.endsWith(".translate"));
}

function statusVariant(status: AdminUserStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "suspended" || status === "banned") return "danger";
  return "neutral";
}

export function UsersPageClient({
  initialUsers,
  source,
  roles,
}: {
  initialUsers: AdminUser[];
  source: "firestore" | "mock";
  roles: AdminRoleDoc[];
}) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<AdminRole | "all">("all");
  const [status, setStatus] = useState<AdminUserStatus | "all">("all");

  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const assignableRoles = useMemo(
    () => roles.filter((r) => r.id !== "keymaster"),
    [roles],
  );
  const roleLabel = (id: string) => roleMap.get(id)?.name ?? id;
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);

  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("users.roles");
  const tStatuses = useTranslations("users.statuses");

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (status !== "all" && u.status !== status) return false;
      if (verifiedOnly && !u.verified) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [users, query, role, status, verifiedOnly]);

  const columns = useMemo<ColumnDef<AdminUser>[]>(
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
            aria-label={t("selectRow", { name: row.original.name })}
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        size: 32,
      },
      {
        id: "user",
        accessorFn: (u) => u.name,
        header: t("columns.user"),
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt="" />}
                <AvatarFallback>{initials(u.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                  <span className="truncate">{u.name}</span>
                  {u.verified && (
                    <BadgeCheck className="size-3.5 text-primary shrink-0" aria-label={t("verified")} />
                  )}
                </div>
                <div className="truncate text-xs text-muted-foreground">{u.email}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        accessorKey: "role",
        header: t("columns.role"),
        cell: ({ row }) => (
          <Badge variant={roleVariant(row.original.role)}>
            {roleLabel(row.original.role)}
          </Badge>
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
        accessorFn: (u) => new Date(u.joinedAt).getTime(),
        header: t("columns.joined"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatRelative(row.original.joinedAt)}
          </span>
        ),
      },
      {
        id: "lastActive",
        accessorFn: (u) => new Date(u.lastActiveAt).getTime(),
        header: t("columns.lastActive"),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatRelative(row.original.lastActiveAt)}
          </span>
        ),
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()} className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("rowActions", { name: u.name })}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDetailUser(u)}>
                    <UserCog /> {t("viewProfile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      toast(t("resetPasswordToast"));
                    }}
                  >
                    <Mail /> {t("resetPassword")}
                  </DropdownMenuItem>
                  {u.status !== "suspended" && (
                    <DropdownMenuItem
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/admin/users/${u.id}`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ status: "suspended" }),
                          });
                          if (!res.ok) throw new Error((await res.json()).error || "Failed");
                          setUsers((prev) =>
                            prev.map((p) =>
                              p.id === u.id ? { ...p, status: "suspended" as const } : p,
                            ),
                          );
                          toast.success(t("suspendedToast", { name: u.name }));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed");
                        }
                      }}
                    >
                      <ShieldX /> {t("suspend")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="danger" onClick={() => setDeleteTarget(u)}>
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
    [t, tCommon, tStatuses, roleMap],
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

  function exportCsv(rows: AdminUser[]) {
    const header = ["id", "name", "email", "role", "status", "verified", "joinedAt", "lastActiveAt"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [r.id, r.name, r.email, r.role, r.status, r.verified, r.joinedAt, r.lastActiveAt]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function applyBulkStatus(next: AdminUserStatus) {
    const ids = selectedIds.slice();
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, op: "status", status: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setUsers((prev) =>
        prev.map((u) => (ids.includes(u.id) ? { ...u, status: next } : u)),
      );
      setRowSelection({});
      toast.success(t("rolesUpdatedToast", { count: ids.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function applyBulkRole(next: AdminRole) {
    const ids = selectedIds.slice();
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, op: "role", role: next }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setUsers((prev) =>
        prev.map((u) => (ids.includes(u.id) ? { ...u, role: next } : u)),
      );
      setRowSelection({});
      toast.success(t("rolesChangedToast", { count: ids.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function applyBulkDelete() {
    const ids = selectedIds.slice();
    try {
      const res = await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, op: "delete" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
      setRowSelection({});
      setBulkDelete(false);
      toast.success(t("deletedToast", { count: ids.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleDeleteOne() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      const res = await fetch(`/api/admin/users/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setDeleteTarget(null);
      toast.success(t("deletedOneToast", { name: target.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-8 w-64"
            aria-label={t("searchAria")}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as AdminRole | "all")}
          aria-label={t("filterByRole")}
        >
          <option value="all">{tRoles("all")}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminUserStatus | "all")}
          aria-label={t("filterByStatus")}
        >
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>{tStatuses(v)}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={verifiedOnly}
            onCheckedChange={(v) => setVerifiedOnly(Boolean(v))}
          />
          {t("verifiedOnly")}
        </label>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <Download /> {t("exportCsv")}
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)} disabled={source === "mock"}>
            <Plus /> {t("inviteUser")}
          </Button>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{t("selectedCount", { count: selectedCount })}</span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">{t("changeRole")}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {assignableRoles.map((r) => (
                  <DropdownMenuItem key={r.id} onClick={() => applyBulkRole(r.id)}>
                    {r.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                toast(t("emailQueuedToast"));
                setRowSelection({});
              }}
            >
              <Mail /> {t("email")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => applyBulkStatus("suspended")}>
              <ShieldX /> {t("suspend")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                exportCsv(users.filter((u) => selectedIds.includes(u.id)))
              }
            >
              <Download /> {t("export")}
            </Button>
            <Button variant="danger" size="sm" onClick={() => setBulkDelete(true)}>
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
                  <td
                    colSpan={columns.length}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
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
                      onClick={() => setDetailUser(row.original)}
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

      <InviteUserDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={assignableRoles}
        onInvite={(u) => {
          setUsers((prev) => [u, ...prev]);
          toast.success(t("inviteSentToast", { email: u.email }));
        }}
      />

      <UserDetailSheet
        user={detailUser}
        roles={assignableRoles}
        roleMap={roleMap}
        onOpenChange={(next) => !next && setDetailUser(null)}
        onUpdated={(updated) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
          );
          setDetailUser((cur) => (cur && cur.id === updated.id ? { ...cur, ...updated } : cur));
        }}
        onDelete={(u) => {
          setDetailUser(null);
          setDeleteTarget(u);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t("deleteOneTitle")}
        description={deleteTarget ? t("deleteOneDescription", { name: deleteTarget.name }) : ""}
        confirmLabel={tCommon("delete")}
        confirmWord={deleteTarget?.name}
        onConfirm={handleDeleteOne}
      />

      <ConfirmDialog
        open={bulkDelete}
        onOpenChange={setBulkDelete}
        title={t("deleteBulkTitle", { count: selectedCount })}
        description={t("deleteBulkDescription")}
        confirmLabel={t("deleteBulkLabel", { count: selectedCount })}
        confirmWord={t("deleteBulkConfirmWord", { count: selectedCount })}
        onConfirm={applyBulkDelete}
      />
    </div>
  );
}

function UserDetailSheet({
  user,
  roles,
  roleMap,
  onOpenChange,
  onDelete,
  onUpdated,
}: {
  user: AdminUser | null;
  roles: AdminRoleDoc[];
  roleMap: Map<string, AdminRoleDoc>;
  onOpenChange: (open: boolean) => void;
  onDelete: (u: AdminUser) => void;
  onUpdated: (next: Partial<AdminUser> & { id: string }) => void;
}) {
  const t = useTranslations("users");
  const tDrawer = useTranslations("users.drawer");
  const tStatuses = useTranslations("users.statuses");
  const tCommon = useTranslations("common");

  const currentRoleDoc = user ? roleMap.get(user.role) : undefined;

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">{tDrawer("title")}</DialogTitle>
        <DialogDescription className="sr-only">{tDrawer("description")}</DialogDescription>
        {user && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1 text-base font-semibold text-foreground">
                  {user.name}
                  {user.verified && <BadgeCheck className="size-4 text-primary" aria-label={t("verified")} />}
                </div>
                <div className="text-sm text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={roleVariant(user.role)}>
                {currentRoleDoc?.name ?? user.role}
              </Badge>
              <Badge variant={statusVariant(user.status)}>{tStatuses(user.status)}</Badge>
              {(user.languages?.length ?? 0) > 0 && (
                <span className="text-xs text-muted-foreground">
                  {user.languages!
                    .map((l) => LANG_LABELS[l] ?? l)
                    .join(", ")}
                </span>
              )}
            </div>

            <Tabs defaultValue="profile">
              <TabsList>
                <TabsTrigger value="profile">{tDrawer("tabProfile")}</TabsTrigger>
                <TabsTrigger value="role">{tDrawer("tabRole")}</TabsTrigger>
                <TabsTrigger value="activity">{tDrawer("tabActivity")}</TabsTrigger>
                <TabsTrigger value="content">{tDrawer("tabContent")}</TabsTrigger>
                <TabsTrigger value="donations">{tDrawer("tabDonations")}</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-3 pt-3">
                <Row label={tDrawer("userId")} value={user.id} mono />
                <Row label={tDrawer("joinedLabel")} value={new Date(user.joinedAt).toLocaleString()} />
                <Row label={tDrawer("lastActiveLabel")} value={new Date(user.lastActiveAt).toLocaleString()} />
                <Row label={tDrawer("emailVerified")} value={user.verified ? tCommon("yes") : tCommon("no")} />
              </TabsContent>
              <TabsContent value="role" className="pt-3">
                <RoleAssignmentEditor
                  key={user.id}
                  user={user}
                  roles={roles}
                  roleMap={roleMap}
                  onUpdated={onUpdated}
                />
              </TabsContent>
              <TabsContent value="activity" className="pt-3 text-sm text-muted-foreground">
                {tDrawer("activityPlaceholder")}
              </TabsContent>
              <TabsContent value="content" className="pt-3 text-sm text-muted-foreground">
                {tDrawer("contentPlaceholder")}
              </TabsContent>
              <TabsContent value="donations" className="pt-3 text-sm text-muted-foreground">
                {tDrawer("donationsPlaceholder")}
              </TabsContent>
            </Tabs>

            <div className="rounded-md border border-danger/30 bg-danger/5 p-4">
              <h3 className="text-sm font-semibold text-danger">{tDrawer("dangerZone")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{tDrawer("dangerZoneNote")}</p>
              <div className="mt-3">
                <Button variant="danger" size="sm" onClick={() => onDelete(user)}>
                  <Trash2 /> {tDrawer("deleteUser")}
                </Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{tCommon("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

// Local editor for a single user's role + per-translator language scope. The
// parent keys this on `user.id` so swapping users inside the open sheet
// remounts it — that gives us a clean initial state without a useEffect sync.
function RoleAssignmentEditor({
  user,
  roles,
  roleMap,
  onUpdated,
}: {
  user: AdminUser;
  roles: AdminRoleDoc[];
  roleMap: Map<string, AdminRoleDoc>;
  onUpdated: (next: Partial<AdminUser> & { id: string }) => void;
}) {
  const tCommon = useTranslations("common");
  const [pendingRole, setPendingRole] = useState<string>(user.role);
  const [pendingLangs, setPendingLangs] = useState<string[]>([...(user.languages ?? [])]);
  const [savingAssignment, startSaveTransition] = useTransition();

  const currentRoleDoc = roleMap.get(user.role);
  const pendingRoleDoc = pendingRole ? roleMap.get(pendingRole) : undefined;
  const showLanguagesPicker = roleHasTranslate(pendingRoleDoc);
  const isProtectedAssignment = currentRoleDoc?.protected ?? false;

  const langOptions: SearchableMultiComboboxOption[] = useMemo(
    () =>
      ASSIGNABLE_LANGS.map((code) => ({
        value: code,
        label: LANG_LABELS[code] ?? code.toUpperCase(),
      })),
    [],
  );

  const dirty =
    pendingRole !== user.role ||
    JSON.stringify([...pendingLangs].sort()) !==
      JSON.stringify([...(user.languages ?? [])].sort());

  async function saveAssignment() {
    if (!dirty) return;
    startSaveTransition(async () => {
      try {
        const body: Record<string, unknown> = {};
        if (pendingRole !== user.role) body.role = pendingRole;
        if (
          JSON.stringify([...pendingLangs].sort()) !==
          JSON.stringify([...(user.languages ?? [])].sort())
        ) {
          body.languages = pendingLangs;
        }
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        onUpdated({ id: user.id, role: pendingRole, languages: pendingLangs });
        toast.success(`Updated ${user.name}.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-md border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold">Role & languages</h3>
      {isProtectedAssignment ? (
        <p className="text-sm text-muted-foreground">
          This user holds a protected role. Reassignment is managed by the
          <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">npm run seed:roles</code>
          script.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="user-role">
              Role
            </label>
            <select
              id="user-role"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={pendingRole}
              onChange={(e) => setPendingRole(e.target.value)}
              disabled={savingAssignment}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {showLanguagesPicker && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Approved languages</label>
              <p className="text-xs text-muted-foreground">
                Leave empty to grant access to every language.
              </p>
              <SearchableMultiCombobox
                options={langOptions}
                value={pendingLangs}
                onChange={setPendingLangs}
                placeholder="Select languages…"
                searchPlaceholder="Search languages…"
                emptyText="No matches."
                disabled={savingAssignment}
                ariaLabel="Approved languages"
                className="w-full"
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={saveAssignment} disabled={!dirty || savingAssignment}>
              {savingAssignment ? tCommon("working") : "Save"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
