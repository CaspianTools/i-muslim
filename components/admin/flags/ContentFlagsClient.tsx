"use client";

import { Fragment, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { resolveFlagAction, dismissFlagAction } from "@/lib/admin/actions/content-flags";
import type { ContentFlag, ContentFlagStatus } from "@/types/content-flag";

interface Props {
  initialFlags: ContentFlag[];
  canPersist: boolean;
}

type StatusFilter = "all" | ContentFlagStatus;
type SortKey = "item" | "reporter" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const STATUS_FILTERS: StatusFilter[] = ["all", "open", "resolved", "dismissed"];

function statusVariant(s: ContentFlagStatus): "warning" | "success" | "neutral" {
  if (s === "open") return "warning";
  if (s === "resolved") return "success";
  return "neutral";
}

function defaultDirFor(key: SortKey): SortDir {
  return key === "createdAt" ? "desc" : "asc";
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
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      <span>{label}</span>
      <Icon className={`size-3 ${active ? "text-foreground" : "opacity-60"}`} />
    </button>
  );
}

export function ContentFlagsClient({ initialFlags, canPersist }: Props) {
  const t = useTranslations("flagsAdmin");
  const tStatus = useTranslations("flagsAdmin.statuses");
  const locale = useLocale();
  const [flags, setFlags] = useState(initialFlags);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = flags.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (!q) return true;
      return (
        f.reference.toLowerCase().includes(q) ||
        f.note.toLowerCase().includes(q) ||
        (f.reporterEmail ?? "").toLowerCase().includes(q)
      );
    });
    const sign = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortKey === "item") {
        cmp = a.reference.localeCompare(b.reference);
      } else if (sortKey === "reporter") {
        cmp = (a.reporterEmail ?? "").localeCompare(b.reporterEmail ?? "");
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      if (cmp !== 0) return cmp * sign;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [flags, query, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDirFor(key));
    }
  }

  async function resolve(id: string) {
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await resolveFlagAction(id);
    if (!r.ok) return toast.error(r.error);
    setFlags((prev) => prev.map((x) => (x.id === id ? { ...x, status: "resolved" } : x)));
    toast.success(t("resolvedToast"));
  }

  async function dismiss(id: string) {
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await dismissFlagAction(id);
    if (!r.ok) return toast.error(r.error);
    setFlags((prev) => prev.map((x) => (x.id === id ? { ...x, status: "dismissed" } : x)));
    toast.success(t("dismissedToast"));
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
            className="ps-8 w-64"
            aria-label={t("search")}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label={t("filterByStatus")}
        >
          {STATUS_FILTERS.map((v) => (
            <option key={v} value={v}>
              {tStatus(v)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {flags.length === 0 ? t("empty") : t("noResults")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("colItem")}
                    active={sortKey === "item"}
                    dir={sortDir}
                    onToggle={() => toggleSort("item")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("colReporter")}
                    active={sortKey === "reporter"}
                    dir={sortDir}
                    onToggle={() => toggleSort("reporter")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("colStatus")}
                    active={sortKey === "status"}
                    dir={sortDir}
                    onToggle={() => toggleSort("status")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("colCreated")}
                    active={sortKey === "createdAt"}
                    dir={sortDir}
                    onToggle={() => toggleSort("createdAt")}
                  />
                </th>
                <th className="px-3 py-2 text-end">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const isOpen = expanded.has(f.id);
                return (
                  <Fragment key={f.id}>
                    <tr className="border-t border-border align-top">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">
                            {f.itemType === "hadith" ? t("typeHadith") : t("typeAyah")}
                          </Badge>
                          {f.href ? (
                            <Link
                              href={f.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-foreground no-underline hover:text-primary hover:no-underline"
                            >
                              {f.reference}
                            </Link>
                          ) : (
                            <span className="font-medium text-foreground">{f.reference}</span>
                          )}
                        </div>
                        {(f.locale || f.note) && (
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            {f.locale && <span>{f.locale}</span>}
                            {f.note && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(f.id)}
                                aria-expanded={isOpen}
                                className="inline-flex items-center gap-1 font-medium uppercase tracking-wide hover:text-foreground"
                              >
                                {isOpen ? (
                                  <ChevronDown className="size-3" />
                                ) : (
                                  <ChevronRight className="size-3" />
                                )}
                                {t("colNote")}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {f.reporterEmail ?? t("anonymous")}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusVariant(f.status)}>{tStatus(f.status)}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(f.createdAt).toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        {f.status === "open" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              onClick={() => resolve(f.id)}
                              disabled={!canPersist}
                              title={t("resolveCta")}
                              aria-label={t("resolveCta")}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => dismiss(f.id)}
                              disabled={!canPersist}
                              title={t("dismissCta")}
                              aria-label={t("dismissCta")}
                              className="h-8 w-8 p-0"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isOpen && f.note && (
                      <tr className="bg-muted/40">
                        <td colSpan={5} className="px-3 pb-3 pt-1">
                          <p className="whitespace-pre-wrap text-sm text-foreground">{f.note}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
