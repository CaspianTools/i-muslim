"use client";

import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Archive, Check, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export function BusinessReportsClient({ initialReports, canPersist }: Props) {
  const t = useTranslations("businesses.admin");
  const tReason = useTranslations("businesses.report.reasons");
  const tStatus = useTranslations("businesses.admin.reportStatuses");
  const locale = useLocale();
  const [reports, setReports] = useState(initialReports);
  const [tab, setTab] = useState<BusinessReportStatus>("open");

  const filtered = useMemo(
    () =>
      reports
        .filter((r) => r.status === tab)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reports, tab],
  );

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
    <Tabs value={tab} onValueChange={(v) => setTab(v as BusinessReportStatus)}>
      <TabsList>
        <TabsTrigger value="open">{t("reportsTabOpen")}</TabsTrigger>
        <TabsTrigger value="resolved">{t("reportsTabResolved")}</TabsTrigger>
        <TabsTrigger value="dismissed">{t("reportsTabDismissed")}</TabsTrigger>
      </TabsList>
      {(["open", "resolved", "dismissed"] as BusinessReportStatus[]).map((s) => (
        <TabsContent key={s} value={s} className="mt-4">
          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("reportsEmpty")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{t("reportsColBusiness")}</th>
                    <th className="px-3 py-2">{t("reportsColReason")}</th>
                    <th className="px-3 py-2">{t("reportsColReporter")}</th>
                    <th className="px-3 py-2">{t("reportsColCreated")}</th>
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
                            rel="noopener"
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
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString(locale)}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        {r.status === "open" ? (
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
                        ) : (
                          <Badge variant="neutral">{tStatus(r.status)}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
