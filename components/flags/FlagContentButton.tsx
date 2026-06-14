"use client";

import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Flag } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { FlagContentDialog } from "@/components/flags/FlagContentDialog";
import type { ContentFlagItemType } from "@/types/content-flag";
import { cn } from "@/lib/utils";

interface Props {
  itemType: ContentFlagItemType;
  itemId: string;
  reference: string;
  href: string;
  locale: string;
  /**
   * Server-known auth state from `getSiteSession()`. Reporting requires a
   * signed-in user (so flags dedupe per user); anon clicks get a sign-in toast.
   */
  signedIn?: boolean;
  /** Hide the label and only show the icon. Defaults to false. */
  iconOnly?: boolean;
  className?: string;
}

export function FlagContentButton({
  itemType,
  itemId,
  reference,
  href,
  locale,
  signedIn = false,
  iconOnly = false,
  className,
}: Props) {
  const t = useTranslations("flags");
  const [open, setOpen] = useState(false);

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      toast.error(t("report.signInRequired"), {
        action: {
          label: t("report.signInCta"),
          onClick: () => {
            window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
          },
        },
      });
      return;
    }
    setOpen(true);
  }

  const label = t("buttonLabel");

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
          "ui-selected-chip-idle",
          className,
        )}
      >
        <Flag className="size-4" />
        {!iconOnly && <span>{label}</span>}
      </button>
      <FlagContentDialog
        open={open}
        onClose={() => setOpen(false)}
        itemType={itemType}
        itemId={itemId}
        reference={reference}
        href={href}
        locale={locale}
      />
    </>
  );
}
