"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleMosqueLike } from "@/app/[locale]/(site)/mosques/like-actions";

/** Masjid-level Like (heart + count), distinct from Follow and per-post reactions. */
export function MosqueLikeButton({
  slug,
  initialLiked,
  initialCount,
  signedIn,
}: {
  slug: string;
  initialLiked: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const t = useTranslations("mosques.like");
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      toast.error(t("signInToLike"));
      return;
    }
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await toggleMosqueLike(slug);
      if (!res.ok) {
        setLiked(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        toast.error(t("failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-10 w-10 px-0 sm:h-8 sm:w-auto sm:px-3"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? t("liked") : t("like")}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart className={`size-4${liked ? " fill-current text-danger" : ""}`} />
      )}
      <span className="hidden sm:inline">
        {liked ? t("liked") : t("like")}
        {count > 0 ? ` · ${count}` : ""}
      </span>
    </Button>
  );
}
