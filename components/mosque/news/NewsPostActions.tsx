"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Hand, Heart, MessageCircle, ShieldOff, Trash2 } from "lucide-react";
import {
  reactNewsPost,
  deleteNewsPost,
  takeDownNewsPost,
} from "@/app/[locale]/(site)/mosques/news-actions";
import type {
  MosqueNewsReactionKind,
  MosqueNewsReactionCounts,
  MosqueNewsMyReactions,
} from "@/types/mosque-news";

const REACTIONS: { kind: MosqueNewsReactionKind; Icon: ComponentType<{ className?: string }>; heart?: boolean }[] = [
  { kind: "amen", Icon: Check },
  { kind: "dua", Icon: Hand },
  { kind: "heart", Icon: Heart, heart: true },
];

export function NewsPostActions({
  slug,
  postId,
  initialCounts,
  initialMine,
  commentCount,
  signedIn,
  canManage,
  canModerate,
  children,
}: {
  slug: string;
  postId: string;
  initialCounts: MosqueNewsReactionCounts;
  initialMine: MosqueNewsMyReactions;
  commentCount: number;
  signedIn: boolean;
  canManage: boolean;
  canModerate: boolean;
  /** The comment thread, revealed only when the viewer expands comments. */
  children: ReactNode;
}) {
  const t = useTranslations("mosques.news");
  const router = useRouter();
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState(initialMine);
  const [busy, setBusy] = useState(false);
  const [showComments, setShowComments] = useState(false);

  async function react(kind: MosqueNewsReactionKind) {
    if (!signedIn) {
      toast.error(t("signInToReact"));
      return;
    }
    const had = mine[kind];
    // optimistic
    setMine((m) => ({ ...m, [kind]: !had }));
    setCounts((c) => ({ ...c, [kind]: Math.max(0, c[kind] + (had ? -1 : 1)) }));
    const res = await reactNewsPost(slug, postId, kind);
    if (!res.ok) {
      setMine((m) => ({ ...m, [kind]: had }));
      setCounts((c) => ({ ...c, [kind]: Math.max(0, c[kind] + (had ? 1 : -1)) }));
      toast.error(t("reactFailed"));
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
      <div className="flex items-center gap-1">
        {REACTIONS.map(({ kind, Icon, heart }) => (
          <button
            key={kind}
            type="button"
            onClick={() => react(kind)}
            className={`mq-react-btn${mine[kind] ? " active" : ""}${heart ? " heart" : ""}`}
            aria-pressed={mine[kind]}
            title={t(kind)}
          >
            <Icon className={`size-4${heart && mine.heart ? " fill-current" : ""}`} />
            {t(kind)}
            {counts[kind] > 0 && <span className="text-xs opacity-80">· {counts[kind]}</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className={`mq-react-btn${showComments ? " active" : ""}`}
          aria-expanded={showComments}
          title={t("comment")}
        >
          <MessageCircle className="size-4" />
          {t("comment")}
          {commentCount > 0 && <span className="text-xs opacity-80">· {commentCount}</span>}
        </button>
      </div>

      {(canManage || canModerate) && (
        <div className="flex items-center gap-3 px-1 pt-1 text-xs">
          {canManage && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-danger"
            >
              <Trash2 className="size-3.5" /> {t("delete")}
            </button>
          )}
          {canModerate && (
            <button
              type="button"
              onClick={takeDown}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-danger"
            >
              <ShieldOff className="size-3.5" /> {t("takeDown")}
            </button>
          )}
        </div>
      )}

      {showComments && <div className="mt-2 border-t border-border pt-3">{children}</div>}
    </div>
  );
}
