"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EyeOff, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import {
  deleteMyProfile,
  hideMyProfile,
  republishMyProfile,
} from "@/app/(site)/matrimonial/actions";
import type { ProfileStatus } from "@/types/matrimonial";

export function SettingsActions({ status }: { status: ProfileStatus }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("matrimonial.settings");
  const tCommon = useTranslations("common");

  return (
    <>
      {status === "hidden" ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await republishMyProfile();
              toast.success(t("republished"));
              router.refresh();
            })
          }
        >
          <RefreshCcw /> {t("republish")}
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await hideMyProfile();
              toast(t("hidden"));
              router.refresh();
            })
          }
        >
          <EyeOff /> {t("hide")}
        </Button>
      )}
      <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={pending}>
        <Trash2 /> {t("delete")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={tCommon("delete")}
        confirmWord={t("deleteConfirmWord")}
        onConfirm={() =>
          startTransition(async () => {
            await deleteMyProfile();
            toast.success(t("deleted"));
            router.push("/matrimonial");
            router.refresh();
          })
        }
      />
    </>
  );
}
