"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Share the masjid's public short link via the Web Share API, falling back to copy. */
export function MosqueShareButton({ code, name }: { code: string; name: string }) {
  const t = useTranslations("mosques.community");

  async function share() {
    const url = `${window.location.origin}/m/${code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-10 w-10 px-0 sm:h-8 sm:w-auto sm:px-3"
      onClick={share}
      aria-label={t("share")}
    >
      <Share2 className="size-4" />
      <span className="hidden sm:inline">{t("share")}</span>
    </Button>
  );
}
