"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { flagContentAction } from "@/app/[locale]/(site)/flag-actions";
import type { ContentFlagItemType } from "@/types/content-flag";

interface Props {
  open: boolean;
  onClose: () => void;
  itemType: ContentFlagItemType;
  itemId: string;
  reference: string;
  href: string;
  locale: string;
}

export function FlagContentDialog({
  open,
  onClose,
  itemType,
  itemId,
  reference,
  href,
  locale,
}: Props) {
  const t = useTranslations("flags.report");
  const tCommon = useTranslations("common");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function handleClose() {
    if (pending) return;
    setNote("");
    onClose();
  }

  function submit() {
    startTransition(async () => {
      const r = await flagContentAction({ itemType, itemId, reference, href, locale, note });
      if (!r.ok) {
        toast.error(r.error || t("errorGeneric"));
        return;
      }
      toast.success(r.alreadyFlagged ? t("alreadyToast") : t("submittedToast"));
      setNote("");
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{reference}</p>
        <label className="text-sm font-medium" htmlFor="content-flag-note">
          {t("noteLabel")}
        </label>
        <textarea
          id="content-flag-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="comment-textarea"
          placeholder={t("notePlaceholder")}
          disabled={pending}
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            {tCommon("cancel")}
          </Button>
          <Button onClick={submit} disabled={pending}>
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
