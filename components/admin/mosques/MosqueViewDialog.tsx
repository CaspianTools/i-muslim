"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Edit, XCircle } from "lucide-react";
import { openQuickEditMosque } from "@/components/admin/QuickCreate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EditorDialog,
  EditorDialogBody,
  EditorDialogContent,
  EditorDialogFooter,
} from "@/components/ui/editor-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MosqueProfile } from "@/components/mosque/MosqueProfile";
import { toast } from "sonner";
import { formatRelative } from "@/lib/utils";
import type { Mosque } from "@/types/mosque";
import {
  rejectMosque,
  setMosqueStatus,
} from "@/app/[locale]/(admin)/admin/mosques/actions";

export function MosqueViewDialog({
  open,
  onOpenChange,
  mosque,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mosque: Mosque | null;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("mosquesAdmin.viewDialog");
  const tToast = useTranslations("mosquesAdmin.actions");
  const tCommon = useTranslations("common");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setRejecting(false);
      setRejectReason("");
    }
    onOpenChange(next);
  }

  if (!mosque) return null;
  const isPending = mosque.status === "pending_review";

  function callAction(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onOk: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(`${tToast("errorGeneric")} (${res.error ?? "unknown"})`);
        return;
      }
      onOk();
      router.refresh();
      handleOpenChange(false);
    });
  }

  function handleApprove() {
    if (!mosque) return;
    const slug = mosque.slug;
    callAction(
      () => setMosqueStatus(slug, "published"),
      () => toast.success(tToast("promotedToast")),
    );
  }

  function handleReject() {
    if (!mosque) return;
    const slug = mosque.slug;
    callAction(
      () => rejectMosque(slug, rejectReason),
      () => toast.success(tToast("rejectedToast")),
    );
  }

  return (
    <EditorDialog open={open} onOpenChange={handleOpenChange}>
      <EditorDialogContent>
        {isPending && (
          <div className="border-b border-border bg-warning/5 px-5 py-3 pe-12">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Badge variant="warning">{t("badgeSubmission")}</Badge>
              <span className="text-muted-foreground">
                {t("submittedMeta", {
                  who:
                    mosque.submittedBy?.email
                    ?? mosque.submittedBy?.uid
                    ?? t("anonymous"),
                  when: formatRelative(mosque.createdAt, locale),
                })}
              </span>
            </div>
          </div>
        )}

        <EditorDialogBody className="p-0">
          <div className="px-5 py-6">
            <MosqueProfile mosque={mosque} />
          </div>
        </EditorDialogBody>

        <EditorDialogFooter>
          {isPending ? (
            rejecting ? (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="mosque-view-reject-reason">{t("rejectReasonLabel")}</Label>
                  <Input
                    id="mosque-view-reject-reason"
                    autoFocus
                    placeholder={t("rejectReasonPlaceholder")}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejecting(false);
                      setRejectReason("");
                    }}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={!rejectReason.trim()}
                    onClick={handleReject}
                  >
                    {t("rejectConfirm")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setRejecting(true)}>
                  <XCircle /> {t("reject")}
                </Button>
                <Button onClick={handleApprove}>
                  <CheckCircle2 /> {t("approve")}
                </Button>
              </>
            )
          ) : (
            <>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                {tCommon("close")}
              </Button>
              <Button
                onClick={() => {
                  if (!mosque) return;
                  handleOpenChange(false);
                  openQuickEditMosque(mosque);
                }}
              >
                <Edit /> {t("edit")}
              </Button>
            </>
          )}
        </EditorDialogFooter>
      </EditorDialogContent>
    </EditorDialog>
  );
}
