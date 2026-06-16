"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Heart, MessageCircle, ShieldOff, Trash2 } from "lucide-react";
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
  commentCount,
  signedIn,
  canManage,
  canModerate,
  children,
}: {
  slug: string;
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  commentCount: number;
  signedIn: boolean;
  canManage: boolean;
  canModerate: boolean;
  /** The comment thread, revealed only when the viewer expands comments. */
  children: ReactNode;
}) {
  const t = useTranslations("mosques.news");
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialLikeCount);
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);

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
    <div>
      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          className={
            "inline-flex items-center gap-1.5 " +
            (liked ? "text-danger" : "text-muted-foreground hover:text-foreground")
          }
          aria-pressed={liked}
          title={t("like")}
        >
          <Heart className={"size-4 " + (liked ? "fill-current" : "")} />
          {count > 0 ? count : t("like")}
        </button>

        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={
            "inline-flex items-center gap-1.5 " +
            (showComments ? "text-foreground" : "text-muted-foreground hover:text-foreground")
          }
          aria-expanded={showComments}
          title={t("comment")}
        >
          <MessageCircle className="size-4" />
          {commentCount > 0 ? commentCount : t("comment")}
        </button>

        {canManage && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-danger"
            title={t("delete")}
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
            title={t("takeDown")}
          >
            <ShieldOff className="size-4" /> {t("takeDown")}
          </button>
        )}
      </div>

      {showComments && <div className="mt-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}
