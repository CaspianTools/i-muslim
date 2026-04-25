"use client";

import * as React from "react";
import { Globe, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { RatesResponse } from "@/lib/zakat/types";

interface Props {
  onApply: (rates: RatesResponse) => void;
  className?: string;
}

export function SyncRatesButton({ onApply, className }: Props) {
  const t = useTranslations("zakat");
  const [pending, startTransition] = React.useTransition();

  const sync = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/zakat/rates", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RatesResponse;
        onApply(data);
        const fxCount = Object.keys(data.fx).length;
        if (fxCount === 0 && data.gold === null && data.silver === null) {
          toast.warning(t("sync.partial"));
        } else if (data.gold === null || data.silver === null) {
          toast.success(t("sync.fxOnly"));
        } else {
          toast.success(t("sync.success"));
        }
      } catch (err) {
        console.error(err);
        toast.error(t("sync.error"));
      }
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={sync}
      className={className}
    >
      {pending ? (
        <RefreshCcw className="size-4 animate-spin" />
      ) : (
        <Globe className="size-4" />
      )}
      {t("sync.button")}
    </Button>
  );
}
