"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  expressInterest,
  respondInterest,
  withdrawInterest,
} from "@/app/[locale]/(site)/matrimonial/actions";
import type { MatrimonialInterest } from "@/types/matrimonial";

interface Props {
  targetId: string;
  myInterest: MatrimonialInterest | null;
  theirInterest: MatrimonialInterest | null;
  matched: boolean;
}

export function InterestButton({ targetId, myInterest, theirInterest, matched }: Props) {
  const router = useRouter();
  const t = useTranslations("matrimonial.profile");
  const [pending, startTransition] = useTransition();
  const [rateLimit, setRateLimit] = useState<{ resetsAt: string } | null>(null);

  if (matched) {
    return (
      <div className="rounded-md border border-success/30 bg-success/10 p-4">
        <div className="text-sm font-semibold text-success">{t("matchedTitle")}</div>
        <p className="mt-1 text-xs text-success-foreground">{t("matchedBody")}</p>
        <Button className="mt-3" variant="secondary" disabled>
          {/* chat coming in phase 4 */}
          {t("matchedTitle")}
        </Button>
      </div>
    );
  }

  if (theirInterest?.status === "pending") {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
        <div className="text-sm font-semibold">{t("incomingTitle", { name: targetId })}</div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await respondInterest(targetId, "accepted");
                toast.success(t("matchedTitle"));
                router.refresh();
              })
            }
          >
            <Heart /> {t("accept")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await respondInterest(targetId, "declined");
                router.refresh();
              })
            }
          >
            <X /> {t("decline")}
          </Button>
        </div>
      </div>
    );
  }

  if (myInterest?.status === "pending") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled>{t("interestPending")}</Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await withdrawInterest(targetId);
              router.refresh();
            })
          }
        >
          {t("withdrawInterest")}
        </Button>
      </div>
    );
  }

  if (myInterest?.status === "declined") {
    return <div className="text-sm text-muted-foreground">{t("interestDeclined")}</div>;
  }

  return (
    <div className="space-y-2">
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await expressInterest(targetId, null);
            if (!res.ok && res.reason === "rate_limit") {
              setRateLimit({ resetsAt: res.resetsAt ?? "" });
              return;
            }
            if (!res.ok) {
              toast.error(res.reason ?? "error");
              return;
            }
            toast.success(t("interestSent"));
            router.refresh();
          })
        }
      >
        <Heart /> {pending ? t("expressing") : t("expressInterest")}
      </Button>
      {rateLimit && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          {t("rateLimitHit", { resetsAt: new Date(rateLimit.resetsAt).toLocaleString() })}
        </div>
      )}
    </div>
  );
}
