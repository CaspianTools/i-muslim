"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatRelative } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
import type { Mosque, MosqueSubmission } from "@/types/mosque";
import {
  promoteSubmission,
  rejectSubmission,
  setMosqueStatus,
} from "@/app/(admin)/admin/mosques/actions";

export function ModerationQueueClient({
  submissions,
  pendingMosques,
}: {
  submissions: MosqueSubmission[];
  pendingMosques: Mosque[];
}) {
  const router = useRouter();
  const t = useTranslations("mosquesAdmin");
  const tActions = useTranslations("mosquesAdmin.queueActions");
  const tToast = useTranslations("mosquesAdmin.actions");
  const tCommon = useTranslations("common");
  const [, startTransition] = useTransition();
  const [rejectTarget, setRejectTarget] = useState<MosqueSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const empty = submissions.length === 0 && pendingMosques.length === 0;

  function callAction(fn: () => Promise<{ ok: boolean; error?: string }>, onOk: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(`${tToast("errorGeneric")} (${res.error ?? "unknown"})`);
        return;
      }
      onOk();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {empty ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("queueEmpty")}
        </p>
      ) : (
        <>
          {submissions.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Public submissions ({submissions.length})
              </h2>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <Th>{t("queueColumns.name")}</Th>
                      <Th>{t("queueColumns.city")}</Th>
                      <Th>{t("queueColumns.submittedBy")}</Th>
                      <Th>{t("queueColumns.submittedAt")}</Th>
                      <Th className="w-44 text-end">{t("queueColumns.actions")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{s.payload.name?.en ?? "—"}</div>
                          {s.payload.name?.ar && (
                            <div dir="rtl" lang="ar" className="font-arabic text-xs text-muted-foreground">
                              {s.payload.name.ar}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {s.payload.city}
                          {s.payload.country && (
                            <span className="ms-1 text-xs">
                              · {countryName(s.payload.country)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {s.submittedBy?.email ?? s.submittedBy?.uid ?? "anonymous"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">
                          {formatRelative(s.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <div className="inline-flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                callAction(
                                  () => promoteSubmission(s.id),
                                  () => toast.success(tToast("promotedToast")),
                                )
                              }
                            >
                              <CheckCircle2 /> {tActions("promote")}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setRejectTarget(s);
                                setRejectReason("");
                              }}
                            >
                              <XCircle /> {tActions("reject")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {pendingMosques.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Pending mosques ({pendingMosques.length})
              </h2>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <Th>{t("queueColumns.name")}</Th>
                      <Th>{t("queueColumns.city")}</Th>
                      <Th>Updated</Th>
                      <Th className="text-end">Status</Th>
                      <Th className="w-44 text-end">{t("queueColumns.actions")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingMosques.map((m) => (
                      <tr key={m.slug} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2 font-medium text-foreground">{m.name.en}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {m.city}, {countryName(m.country)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground tabular-nums">
                          {formatRelative(m.updatedAt)}
                        </td>
                        <td className="px-3 py-2 text-end">
                          <Badge variant="warning">Pending</Badge>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <div className="inline-flex items-center gap-2">
                            <Button size="sm" asChild variant="secondary">
                              <Link href={`/admin/mosques/${m.slug}/edit`}>
                                {tActions("view")} <ExternalLink className="size-3" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                callAction(
                                  () => setMosqueStatus(m.slug, "published"),
                                  () => toast.success(tToast("publishedToast", { name: m.name.en })),
                                )
                              }
                            >
                              <CheckCircle2 /> {tActions("promote")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(next) => !next && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject submission</DialogTitle>
            <DialogDescription>
              Tell the submitter why this submission was rejected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              {tCommon("cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={!rejectReason}
              onClick={() => {
                if (!rejectTarget) return;
                callAction(
                  () => rejectSubmission(rejectTarget.id, rejectReason),
                  () => {
                    toast.success(tToast("rejectedToast"));
                    setRejectTarget(null);
                  },
                );
              }}
            >
              {tActions("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
