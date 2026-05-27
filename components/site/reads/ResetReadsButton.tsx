"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { resetReadsAction } from "@/app/[locale]/(site)/profile/reads/actions";

export function ResetReadsButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("reads");

  function handleConfirm() {
    return new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const res = await resetReadsAction();
          if (res.ok) {
            toast.success(t("resetToast"));
            router.refresh();
          } else {
            toast.error(res.error || t("saveFailed"));
          }
        } catch {
          toast.error(t("saveFailed"));
        } finally {
          resolve();
        }
      });
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="gap-1.5"
      >
        <RotateCcw className="size-4" />
        {t("resetButton")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("resetConfirmTitle")}
        description={t("resetConfirmDescription")}
        confirmWord="RESET"
        confirmLabel={t("resetConfirmCta")}
        onConfirm={handleConfirm}
      />
    </>
  );
}
