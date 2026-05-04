"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  LayoutGrid,
  ListTree,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { openQuickCreate } from "@/components/admin/QuickCreate";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getHijriParts } from "@/lib/admin/hijri";
import { deleteEventAction } from "@/lib/admin/actions/events";
import { describeRRule } from "@/lib/admin/recurrence";
import type {
  AdminEvent,
  EventCategory,
  EventStatus,
} from "@/types/admin";
import { EventEditorDrawer } from "./EventEditorDrawer";
import { EventsCalendarView } from "./EventsCalendarView";

const PAGE_SIZES = [10, 25, 50, 100];

const CATEGORY_VALUES = [
  "all",
  "prayer",
  "lecture",
  "iftar",
  "janazah",
  "class",
  "fundraiser",
  "community",
  "other",
] as const;
const STATUS_VALUES = ["all", "under_review", "draft", "published", "cancelled"] as const;
const WINDOW_VALUES = ["upcoming", "past", "all"] as const;

type WindowFilter = (typeof WINDOW_VALUES)[number];

function categoryVariant(category: EventCategory): "accent" | "info" | "success" | "warning" | "danger" | "neutral" {
  switch (category) {
    case "prayer":
      return "accent";
    case "lecture":
    case "class":
      return "info";
    case "iftar":
    case "community":
      return "success";
    case "fundraiser":
      return "warning";
    case "janazah":
      return "danger";
    default:
      return "neutral";
  }
}

function statusVariant(status: EventStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "under_review") return "warning";
  if (status === "draft") return "neutral";
  if (status === "cancelled") return "danger";
  return "warning";
}

export function EventsPageClient({
  initialEvents,
  source,
}: {
  initialEvents: AdminEvent[];
  source: "firestore" | "mock";
}) {
  const searchParams = useSearchParams();
  const initialStatus = (() => {
    const raw = searchParams?.get("status");
    if (
      raw === "under_review" ||
      raw === "draft" ||
      raw === "published" ||
      raw === "cancelled" ||
      raw === "all"
    ) {
      return raw as EventStatus | "all";
    }
    return "all";
  })();
  const [events, setEvents] = useState<AdminEvent[]>(initialEvents);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const [status, setStatus] = useState<EventStatus | "all">(initialStatus);
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("upcoming");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "startsAt", desc: false },
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminEvent | null>(null);

  const t = useTranslations("events");
  const tCategories = useTranslations("events.categories");
  const tStatuses = useTranslations("events.statuses");
  const tWindow = useTranslations("events.windows");
  const tHijriMonths = useTranslations("hijri.months");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const canPersist = source === "firestore";

  const filtered = useMemo(() => {
    const now = Date.now();
    return events.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (status !== "all" && e.status !== status) return false;
      if (windowFilter === "upcoming" && new Date(e.startsAt).getTime() < now) return false;
      if (windowFilter === "past" && new Date(e.startsAt).getTime() >= now) return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack = [
          e.title,
          e.organizer.name,
          e.location.venue ?? "",
          e.location.address ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, query, category, status, windowFilter]);

  const columns = useMemo<ColumnDef<AdminEvent>[]>(
    () => [
      {
        id: "title",
        accessorFn: (e) => e.title,
        header: t("columns.title"),
        cell: ({ row }) => {
          const e = row.original;
          const recurrenceLabel = e.hijriAnchor
            ? t("recurrenceHijri")
            : e.recurrence
              ? describeRRule(e.recurrence)
              : null;
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground truncate">{e.title}</span>
                {recurrenceLabel && (
                  <span title={recurrenceLabel} aria-label={recurrenceLabel}>
                    <Repeat className="size-3 shrink-0 text-muted-foreground" />
                  </span>
                )}
                {e.startAnchor && (
                  <span
                    title={t("anchorIndicator", { prayer: e.startAnchor.prayer })}
                    aria-label={t("anchorIndicator", { prayer: e.startAnchor.prayer })}
                  >
                    <Clock className="size-3 shrink-0 text-muted-foreground" />
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "category",
        accessorKey: "category",
        header: t("columns.category"),
        cell: ({ row }) => (
          <Badge variant={categoryVariant(row.original.category)}>
            {tCategories(row.original.category)}
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
        id: "startsAt",
        accessorFn: (e) => new Date(e.startsAt).getTime(),
        header: t("columns.when"),
        cell: ({ row }) => {
          const e = row.original;
          const d = new Date(e.startsAt);
          const hijri = getHijriParts(d);
          const dateStr = d.toLocaleDateString(locale, {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const timeStr = d.toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div className="text-sm">
              <div className="text-foreground tabular-nums">
                {dateStr} · {timeStr}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {hijri.day} {tHijriMonths(String(hijri.monthIndex))} {hijri.year}
              </div>
            </div>
          );
        },
      },
      {
        id: "location",
        accessorFn: (e) => e.location.venue ?? e.location.url ?? "",
        header: t("columns.location"),
        cell: ({ row }) => {
          const loc = row.original.location;
          const Icon = loc.mode === "online" ? Globe : MapPin;
          const text = loc.venue ?? loc.address ?? loc.url ?? "—";
          return (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate" title={text}>{text}</span>
            </div>
          );
        },
      },
      {
        id: "organizer",
        accessorFn: (e) => e.organizer.name,
        header: t("columns.organizer"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground truncate">
            {row.original.organizer.name}
          </span>
        ),
      },
      {
        id: "rsvp",
        accessorKey: "rsvpCount",
        header: t("columns.rsvp"),
        cell: ({ row }) => {
          const e = row.original;
          return (
            <span className="text-sm tabular-nums text-muted-foreground">
              {e.capacity != null
                ? t("rsvpOfCapacity", { count: e.rsvpCount, capacity: e.capacity })
                : t("rsvpCount", { count: e.rsvpCount })}
            </span>
          );
        },
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div onClick={(ev) => ev.stopPropagation()} className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("rowActions", { name: e.title })}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(e);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil /> {tCommon("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="danger"
                    onClick={() => setDeleteTarget(e)}
                  >
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
    [t, tCategories, tStatuses, tHijriMonths, tCommon, locale],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
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

  function handleSaved(saved: AdminEvent, mode: "create" | "update") {
    setEvents((prev) => {
      if (mode === "create") return [saved, ...prev];
      return prev.map((e) => (e.id === saved.id ? saved : e));
    });
    toast.success(
      mode === "create"
        ? t("createdToast", { name: saved.title })
        : t("updatedToast", { name: saved.title }),
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    if (!canPersist) {
      setEvents((prev) => prev.filter((e) => e.id !== target.id));
      setDeleteTarget(null);
      toast.success(t("deletedToast", { name: target.title }));
      return;
    }
    const result = await deleteEventAction(target.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== target.id));
    setDeleteTarget(null);
    toast.success(t("deletedToast", { name: target.title }));
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="table" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="table">
              <ListTree className="me-1 size-3.5" /> {t("viewTable")}
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <LayoutGrid className="me-1 size-3.5" /> {t("viewCalendar")}
            </TabsTrigger>
          </TabsList>
        </div>

      <TabsContent value="table" className="space-y-4">
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
          value={category}
          onChange={(e) => setCategory(e.target.value as EventCategory | "all")}
          aria-label={t("filterByCategory")}
        >
          {CATEGORY_VALUES.map((v) => (
            <option key={v} value={v}>
              {v === "all" ? tCategories("all") : tCategories(v)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as EventStatus | "all")}
          aria-label={t("filterByStatus")}
        >
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {v === "all" ? tStatuses("all") : tStatuses(v)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={windowFilter}
          onChange={(e) => setWindowFilter(e.target.value as WindowFilter)}
          aria-label={t("filterByWindow")}
        >
          {WINDOW_VALUES.map((v) => (
            <option key={v} value={v}>{tWindow(v)}</option>
          ))}
        </select>
        <div className="ms-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => openQuickCreate("event")}
            disabled={!canPersist}
            title={!canPersist ? t("noPersistTitle") : undefined}
          >
            <Plus /> {t("newEvent")}
          </Button>
        </div>
      </div>

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
                    <div className="inline-flex items-center gap-2">
                      <CalendarDays className="size-4" />
                      {t("noResults")}
                    </div>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => {
                      setEditing(row.original);
                      setEditorOpen(true);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
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
      <TabsContent value="calendar">
        <EventsCalendarView
          events={events}
          onEdit={(e) => {
            setEditing(e);
            setEditorOpen(true);
          }}
        />
      </TabsContent>
      </Tabs>

      <EventEditorDrawer
        open={editorOpen}
        onOpenChange={(next) => {
          setEditorOpen(next);
          if (!next) setEditing(null);
        }}
        event={editing}
        canPersist={canPersist}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={t("deleteTitle")}
        description={
          deleteTarget ? t("deleteDescription", { name: deleteTarget.title }) : ""
        }
        confirmLabel={tCommon("delete")}
        confirmWord={deleteTarget?.title}
        onConfirm={handleDelete}
      />
    </div>
  );
}
