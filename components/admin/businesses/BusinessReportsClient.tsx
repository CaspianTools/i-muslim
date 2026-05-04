"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  resolveReportAction,
  dismissReportAction,
} from "@/lib/admin/actions/business-reports";
import { archiveBusinessAction } from "@/lib/admin/actions/businesses";
import type { BusinessReport, BusinessReportStatus } from "@/types/business";

interface Props {
  initialReports: BusinessReport[];
  canPersist: boolean;
}

type StatusFilter = "all" | BusinessReportStatus;
type SortKey = "business" | "reason" | "reporter" | "status" | "createdAt";
type SortDir = "asc" | "desc";

const STATUS_FILTERS: StatusFilter[] = ["all", "open", "resolved", "dismissed"];

function statusVariant(s: BusinessReportStatus): "warning" | "success" | "neutral" {
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

export function BusinessReportsClient({ initialReports, canPersist }: Props) {
  const t = useTranslations("businesses.admin");
  const tReason = useTranslations("businesses.report.reasons");
  const tStatus = useTranslations("businesses.admin.reportStatuses");
  const locale = useLocale();
  const [reports, setReports] = useState(initialReports);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.businessName.toLowerCase().includes(q) ||
        tReason(r.reason).toLowerCase().includes(q) ||
        (r.reporterEmail ?? "").toLowerCase().includes(q) ||
        (r.note ?? "").toLowerCase().includes(q)
      );
    });
    const sign = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortKey === "business") {
        cmp = a.businessName.localeCompare(b.businessName);
      } else if (sortKey === "reason") {
        cmp = tReason(a.reason).localeCompare(tReason(b.reason));
      } else if (sortKey === "reporter") {
        cmp = (a.reporterEmail ?? "").localeCompare(b.reporterEmail ?? "");
      } else if (sortKey === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      if (cmp !== 0) return cmp * sign;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [reports, query, statusFilter, sortKey, sortDir, tReason]);

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
    const r = await resolveReportAction(id);
    if (!r.ok) return toast.error(r.error);
    setReports((prev) => prev.map((x) => (x.id === id ? { ...x, status: "resolved" } : x)));
    toast.success(t("reportsResolvedToast"));
  }

  async function dismiss(id: string) {
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await dismissReportAction(id);
    if (!r.ok) return toast.error(r.error);
    setReports((prev) => prev.map((x) => (x.id === id ? { ...x, status: "dismissed" } : x)));
    toast.success(t("reportsDismissedToast"));
  }

  async function archiveBusiness(report: BusinessReport) {
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await archiveBusinessAction(report.businessId);
    if (!r.ok) return toast.error(r.error);
    await resolveReportAction(report.id);
    setReports((prev) =>
      prev.map((x) => (x.id === report.id ? { ...x, status: "resolved" } : x)),
    );
    toast.success(t("reportsResolvedToast"));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("reportsSearch")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-8 w-64"
            aria-label={t("reportsSearch")}
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
          {reports.length === 0 ? t("reportsEmpty") : t("reportsNoResults")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("reportsColBusiness")}
                    active={sortKey === "business"}
                    dir={sortDir}
                    onToggle={() => toggleSort("business")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("reportsColReason")}
                    active={sortKey === "reason"}
                    dir={sortDir}
                    onToggle={() => toggleSort("reason")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("reportsColReporter")}
                    active={sortKey === "reporter"}
                    dir={sortDir}
                    onToggle={() => toggleSort("reporter")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("reportsColStatus")}
                    active={sortKey === "status"}
                    dir={sortDir}
                    onToggle={() => toggleSort("status")}
                  />
                </th>
                <th className="px-3 py-2">
                  <SortHeader
                    label={t("reportsColCreated")}
                    active={sortKey === "createdAt"}
                    dir={sortDir}
                    onToggle={() => toggleSort("createdAt")}
                  />
                </th>
                <th className="px-3 py-2 text-end">{t("reportsColActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{r.businessName}</div>
                    {r.businessSlug && (
                      <Link
                        href={`/businesses/${r.businessSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                      >
                        <ExternalLink className="size-3" /> {t("reportsViewListing")}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="warning">{tReason(r.reason)}</Badge>
                    {r.note && (
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">{r.note}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.reporterEmail ?? t("reportsAnonymous")}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant(r.status)}>{tStatus(r.status)}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    {r.status === "open" && (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => archiveBusiness(r)}
                          disabled={!canPersist}
                        >
                          <Archive className="size-4" /> {t("reportsArchiveBusiness")}
                        </Button>
                        <Button size="sm" onClick={() => resolve(r.id)} disabled={!canPersist}>
                          <Check className="size-4" /> {t("reportsResolveCta")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismiss(r.id)}
                          disabled={!canPersist}
                        >
                          <X className="size-4" /> {t("reportsDismissCta")}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
