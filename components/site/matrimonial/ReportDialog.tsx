"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { reportProfile } from "@/app/[locale]/(site)/matrimonial/actions";
import type { ReportReason } from "@/types/matrimonial";

const REASONS: ReportReason[] = [
  "fake",
  "harassment",
  "inappropriate_photo",
  "non_muslim",
  "scam",
  "other",
];

export function ReportDialog({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("fake");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const t = useTranslations("matrimonial.report");
  const tReasons = useTranslations("matrimonial.report.reasons");
  const tProfile = useTranslations("matrimonial.profile");
  const tCommon = useTranslations("common");

  function submit() {
    startTransition(async () => {
      const res = await reportProfile(targetId, reason, notes || null);
      if (!res.ok) {
        toast.error("Daily report limit reached.");
        return;
      }
      toast.success(t("submitted"));
      setOpen(false);
      setNotes("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag /> {tProfile("report")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("reasonLabel")}</div>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{tReasons(r)}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("notesLabel")}</div>
            <textarea
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>{tCommon("cancel")}</Button>
          <Button variant="danger" onClick={submit} disabled={pending} aria-busy={pending}>
            {pending ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
