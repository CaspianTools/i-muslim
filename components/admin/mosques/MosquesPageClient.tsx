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
import { MosqueViewDialog } from "@/components/admin/mosques/MosqueViewDialog";
import { toast } from "sonner";
import { cn, formatRelative } from "@/lib/utils";
import type { Mosque, MosqueStatus } from "@/types/mosque";
import { deleteMosque, setMosqueStatus } from "@/app/[locale]/(admin)/admin/mosques/actions";
import { countryName } from "@/lib/mosques/countries";

const STATUS_VALUES = [
  "all",
  "draft",
  "pending_review",
  "published",
  "rejected",
  "suspended",
] as const;
const PAGE_SIZES = [10, 25, 50, 100];

type SortKey = "name" | "city" | "country" | "status" | "updatedAt";
type SortDir = "asc" | "desc";

function statusVariant(
  status: MosqueStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "published") return "success";
  if (status === "pending_review") return "warning";
  if (status === "suspended" || status === "rejected") return "danger";
  return "neutral";
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
  initialMosques,
}: {
  initialMosques: Mosque[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("mosquesAdmin");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("mosquesAdmin.statuses");
  const tActions = useTranslations("mosquesAdmin.form.actions");
  const tToast = useTranslations("mosquesAdmin.actions");

  const mosques = initialMosques;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MosqueStatus | "all">("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [deleteTarget, setDeleteTarget] = useState<Mosque | null>(null);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of mosques) if (m.city) set.add(m.city);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [mosques]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of mosques) if (m.country) set.add(m.country);
    return Array.from(set)
      .map((code) => ({ code, label: countryName(code) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mosques]);

  // Auto-open the dialog when arriving via a notification deep-link
  // (?slug=<slug>). Initialized once per mount; the URL param is
  // stripped by the effect below so a refresh doesn't re-open.
  const initialSlug = searchParams.get("slug");
  const [viewMosque, setViewMosque] = useState<Mosque | null>(() => {
    if (!initialSlug) return null;
    return initialMosques.find((m) => m.slug === initialSlug) ?? null;
  });
  useEffect(() => {
    if (initialSlug) router.replace(pathname);
  }, [initialSlug, pathname, router]);

  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const list = mosques.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (cityFilter !== "all" && m.city !== cityFilter) return false;
      if (countryFilter !== "all" && m.country !== countryFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !m.name.en.toLowerCase().includes(q) &&
          !m.city.toLowerCase().includes(q) &&
          !m.country.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    const sign = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.en.localeCompare(b.name.en);
      else if (sortKey === "city") cmp = a.city.localeCompare(b.city);
      else if (sortKey === "country") {
        cmp = countryName(a.country).localeCompare(countryName(b.country));
      } else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "updatedAt") {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      if (cmp !== 0) return cmp * sign;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [mosques, query, status, cityFilter, countryFilter, sortKey, sortDir]);

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

  function callAction(
    name: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onOk: () => void,
  ) {
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
        if (next === "published")
          toast.success(tToast("publishedToast", { name: target.name.en }));
        else if (next === "suspended")
          toast.success(tToast("suspendedToast", { name: target.name.en }));
        else toast.success(tToast("updatedToast", { name: target.name.en }));
      },
    );
  }

  function openRow(mosque: Mosque) {
    // Pending submissions open in a read-only view dialog so the admin can
    // approve/reject without losing context. Everything else jumps to edit.
    if (mosque.status === "pending_review") {
      setViewMosque(mosque);
    } else {
      router.push(`/admin/mosques/${mosque.slug}/edit`);
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
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPageIndex(0);
          }}
          aria-label={t("filterByCity")}
        >
          <option value="all">{t("allCities")}</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={countryFilter}
          onChange={(e) => {
            setCountryFilter(e.target.value);
            setPageIndex(0);
          }}
          aria-label={t("filterByCountry")}
        >
          <option value="all">{t("allCountries")}</option>
          {countryOptions.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
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
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {t("noResults")}
                  </td>
                </tr>
              ) : (
                visible.map((mosque) => (
                  <tr
                    key={mosque.slug}
                    className={cn(
                      "border-b border-border last:border-b-0 hover:bg-muted/40 cursor-pointer",
                    )}
                    onClick={() => openRow(mosque)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{mosque.name.en}</div>
                      {mosque.name.ar && (
                        <div
                          dir="rtl"
                          lang="ar"
                          className="font-arabic text-sm text-muted-foreground"
                        >
                          {mosque.name.ar}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{mosque.city}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {countryName(mosque.country)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={statusVariant(mosque.status)}>
                        {tStatuses(mosque.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">
                      {formatRelative(mosque.updatedAt)}
                    </td>
                    <td
                      className="px-3 py-2 text-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${mosque.name.en}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/mosques/${mosque.slug}/edit`}>
                              <Edit /> {tCommon("edit")}
                            </Link>
                          </DropdownMenuItem>
                          {mosque.status === "published" && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/mosques/${mosque.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Eye /> View public page{" "}
                                <ExternalLink className="ms-auto size-3" />
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {mosque.status !== "published" && (
                            <DropdownMenuItem
                              onClick={() => handleStatus(mosque, "published")}
                            >
                              <Upload /> {tActions("publish")}
                            </DropdownMenuItem>
                          )}
                          {mosque.status === "published" && (
                            <DropdownMenuItem
                              onClick={() => handleStatus(mosque, "draft")}
                            >
                              {tActions("unpublish")}
                            </DropdownMenuItem>
                          )}
                          {mosque.status !== "suspended" && (
                            <DropdownMenuItem
                              onClick={() => handleStatus(mosque, "suspended")}
                            >
                              <ShieldX /> {tActions("suspend")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="danger"
                            onClick={() => setDeleteTarget(mosque)}
                          >
                            <Trash2 /> {tCommon("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
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
        description={
          deleteTarget ? t("deleteDescription", { name: deleteTarget.name.en }) : ""
        }
        confirmLabel={tCommon("delete")}
        confirmWord={deleteTarget?.name.en}
        onConfirm={handleDelete}
      />

      <MosqueViewDialog
        open={Boolean(viewMosque)}
        onOpenChange={(next) => !next && setViewMosque(null)}
        mosque={viewMosque}
      />
    </div>
  );
}
