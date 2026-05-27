"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { toggleReadAction } from "@/app/[locale]/(site)/profile/reads/actions";
import { useReadsContext } from "@/components/site/reads/ReadsContext";
import { readIdFromMark } from "@/lib/reads/ids";
import { toggleLocalRead } from "@/lib/reads/local";
import type { ReadMark } from "@/types/reads";
import { cn } from "@/lib/utils";

interface Props {
  mark: ReadMark;
  /**
   * Server-known auth state from `getSiteSession()`. Drives where the toggle
   * is persisted — Firestore via server action when true, localStorage
   * otherwise.
   */
  signedIn: boolean;
  /** Hide the label and only show the icon. */
  iconOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function MarkAsReadButton({
  mark,
  signedIn,
  iconOnly = false,
  size = "sm",
  className,
}: Props) {
  const readId = readIdFromMark(mark);
  const ctx = useReadsContext();
  const ctxMarked = ctx?.has(readId);
  const [localMarked, setLocalMarked] = useState<boolean>(false);
  const marked = ctxMarked ?? localMarked;
  const [pending, startTransition] = useTransition();
  const t = useTranslations("reads");

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const previous = marked;
    const next = !marked;
    setLocalMarked(next);
    ctx?.setLocal(readId, next);

    if (!signedIn) {
      try {
        toggleLocalRead(mark);
        toast.success(next ? t("markedToast") : t("unmarkedToast"));
      } catch {
        setLocalMarked(previous);
        ctx?.setLocal(readId, previous);
        toast.error(t("saveFailed"));
      }
      return;
    }

    startTransition(async () => {
      try {
        const result = await toggleReadAction(mark);
        if (!result.ok) {
          setLocalMarked(previous);
          ctx?.setLocal(readId, previous);
          if (result.reason === "unauthorized") {
            toast.error(t("signInRequired"), {
              action: {
                label: t("signInCta"),
                onClick: () => {
                  window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
                },
              },
            });
          } else {
            toast.error(t("saveFailed"));
          }
          return;
        }
        if (result.marked !== next) {
          setLocalMarked(result.marked);
          ctx?.setLocal(readId, result.marked);
        }
        toast.success(result.marked ? t("markedToast") : t("unmarkedToast"));
      } catch {
        setLocalMarked(previous);
        ctx?.setLocal(readId, previous);
        toast.error(t("saveFailed"));
      }
    });
  }

  const label = marked ? t("marked") : t("markAsRead");
  const title = signedIn ? label : `${label} ${t("savedLocally")}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={marked}
      aria-label={label}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border transition-colors",
        size === "sm" ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm",
        marked ? "ui-selected-chip" : "ui-selected-chip-idle",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      )}
    >
      <CheckCircle2 className={cn("size-4", marked && "fill-current")} />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
