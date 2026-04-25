"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { setProfileStatus, setReportStatus } from "@/app/[locale]/(admin)/admin/matrimonial/actions";
import { formatRelative } from "@/lib/utils";
import type {
  MatrimonialProfile,
  MatrimonialReport,
  ReportStatus,
} from "@/types/matrimonial";

interface Props {
  reports: MatrimonialReport[];
  profilesById: Record<string, MatrimonialProfile>;
}

function statusVariant(s: ReportStatus): "warning" | "success" | "neutral" {
  if (s === "open") return "warning";
  if (s === "resolved") return "success";
  return "neutral";
}

export function ReportsTable({ reports, profilesById }: Props) {
  const t = useTranslations("matrimonial.admin.reports");
  const tStatuses = useTranslations("matrimonial.admin.reports.statuses");
  const tReasons = useTranslations("matrimonial.report.reasons");
  const tAdmin = useTranslations("matrimonial.admin");
  const [pending, startTransition] = useTransition();
  const [localReports, setLocalReports] = useState(reports);

  if (localReports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {t("noReports")}
      </div>
    );
  }

  function resolve(reportId: string, next: ReportStatus, toastMsg: string) {
    startTransition(async () => {
      await setReportStatus(reportId, next, null);
      setLocalReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: next,
                resolvedAt: next === "open" ? null : new Date().toISOString(),
              }
            : r,
        ),
      );
      toast.success(toastMsg);
    });
  }

  function suspendTarget(targetId: string, reportId: string) {
    startTransition(async () => {
      await setProfileStatus(targetId, "suspended");
      await setReportStatus(reportId, "resolved", null);
      const target = profilesById[targetId];
      setLocalReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status: "resolved", resolvedAt: new Date().toISOString() }
            : r,
        ),
      );
      toast.success(
        target
          ? tAdmin("suspended", { name: target.displayName })
          : t("resolved"),
      );
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("columnReporter")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("columnTarget")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("columnReason")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("columnStatus")}
              </th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("columnCreated")}
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {localReports.map((r) => {
              const reporter = profilesById[r.reporterUserId];
              const target = profilesById[r.targetUserId];
              return (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-b-0 hover:bg-muted/40"
                >
                  <td className="px-3 py-2">{reporter?.displayName ?? r.reporterUserId}</td>
                  <td className="px-3 py-2">{target?.displayName ?? r.targetUserId}</td>
                  <td className="px-3 py-2 text-muted-foreground">{tReasons(r.reason)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(r.status)}>{tStatuses(r.status)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {formatRelative(r.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "open" && (
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={pending}
                          onClick={() => suspendTarget(r.targetUserId, r.id)}
                        >
                          {t("suspendTarget")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => resolve(r.id, "resolved", t("resolved"))}
                        >
                          {t("resolve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => resolve(r.id, "dismissed", t("dismissed"))}
                        >
                          {t("dismiss")}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
