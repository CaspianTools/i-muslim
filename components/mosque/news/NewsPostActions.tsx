"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Heart, ShieldOff, Trash2 } from "lucide-react";
import {
  likeNewsPost,
  deleteNewsPost,
  takeDownNewsPost,
} from "@/app/[locale]/(site)/mosques/news-actions";

export function NewsPostActions({
  slug,
  postId,
  initialLiked,
  initialLikeCount,
  signedIn,
  canManage,
  canModerate,
}: {
  slug: string;
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  signedIn: boolean;
  canManage: boolean;
  canModerate: boolean;
}) {
  const t = useTranslations("mosques.news");
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialLikeCount);
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    if (!signedIn) {
      toast.error(t("signInToLike"));
      return;
    }
    // Optimistic update
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    const res = await likeNewsPost(slug, postId);
    if (!res.ok) {
      // revert
      setLiked((v) => !v);
      setCount((c) => c + (liked ? 1 : -1));
      toast.error(t("likeFailed"));
    }
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    try {
      const res = await deleteNewsPost(slug, postId);
      if (!res.ok) toast.error(t("deleteFailed"));
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function takeDown() {
    setBusy(true);
    try {
      const res = await takeDownNewsPost(slug, postId);
      if (!res.ok) toast.error(t("takeDownFailed"));
      else {
        toast.success(t("takenDown"));
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        type="button"
        onClick={toggleLike}
        className={
          "inline-flex items-center gap-1.5 " +
          (liked ? "text-danger" : "text-muted-foreground hover:text-foreground")
        }
        aria-pressed={liked}
      >
        <Heart className={"size-4 " + (liked ? "fill-current" : "")} />
        {count > 0 ? count : t("like")}
      </button>

      {canManage && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-danger"
        >
          <Trash2 className="size-4" /> {t("delete")}
        </button>
      )}

      {canModerate && (
        <button
          type="button"
          onClick={takeDown}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-danger"
        >
          <ShieldOff className="size-4" /> {t("takeDown")}
        </button>
      )}
    </div>
  );
}
