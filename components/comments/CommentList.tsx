"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/sonner";
import { CommentItem } from "@/components/comments/CommentItem";
import { CommentForm } from "@/components/comments/CommentForm";
import { FlagCommentDialog } from "@/components/comments/FlagCommentDialog";
import {
  COMMENTS_PAGE_SIZE,
  isReactionKind,
  type CommentEntityType,
  type CommentItemMeta,
  type CommentReactionKind,
  type CommentRecord,
} from "@/types/comments";

interface Props {
  entityType: CommentEntityType;
  entityId: string;
  itemMeta: CommentItemMeta;
  initialComments: CommentRecord[];
  initialHasMore: boolean;
  initialUserReactions: Record<string, CommentReactionKind>;
  signedIn: boolean;
  currentUid: string | null;
  /**
   * Comments owned by a parent (e.g. CommentsPopupButton) that should be
   * rendered alongside the fetched page. Used to keep just-posted comments
   * visible across mount cycles — when the popup closes, this list unmounts
   * and loses its local `comments` state, but the parent still holds the
   * seed and re-passes it on reopen so the user's own comment is still shown.
   * Deduped by id against `initialComments` / fetched pages.
   */
  seedComments?: CommentRecord[];
  /**
   * Bubble newly-posted top-level comments up to a parent that wants to
   * remember them (typically to seed them back via `seedComments` on the
   * next mount).
   */
  onCommentCreated?: (c: CommentRecord) => void;
  /** Skip the form (read-only mode). */
  readOnly?: boolean;
}

export function CommentList({
  entityType,
  entityId,
  itemMeta,
  initialComments,
  initialHasMore,
  initialUserReactions,
  signedIn,
  currentUid,
  seedComments,
  onCommentCreated,
  readOnly,
}: Props) {
  const t = useTranslations("comments");
  const tActions = useTranslations("comments.actions");

  const [comments, setComments] = useState<CommentRecord[]>(initialComments);
  const [reactionMap, setReactionMap] = useState<Map<string, CommentReactionKind>>(
    new Map(Object.entries(initialUserReactions).filter(([, v]) => isReactionKind(v))),
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [flagging, setFlagging] = useState<string | null>(null);

  function handleSignInRequired() {
    const cb = typeof window !== "undefined" ? window.location.pathname : "/";
    toast.error(t("errors.signInRequired"), {
      action: {
        label: t("signInCta"),
        onClick: () => {
          window.location.href = `/login?callbackUrl=${encodeURIComponent(cb)}`;
        },
      },
    });
  }

  // Listen for reaction changes (kind toggles) so the active emoji highlight
  // is preserved across re-renders without needing a prop drill back up.
  useEffect(() => {
    function onUserKind(e: Event) {
      const ev = e as CustomEvent<{ id: string; kind: CommentReactionKind | null }>;
      setReactionMap((prev) => {
        const next = new Map(prev);
        if (ev.detail.kind) next.set(ev.detail.id, ev.detail.kind);
        else next.delete(ev.detail.id);
        return next;
      });
    }
    window.addEventListener("comments:user-kind", onUserKind);
    return () => window.removeEventListener("comments:user-kind", onUserKind);
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const url = new URL("/api/comments", window.location.origin);
      url.searchParams.set("entityType", entityType);
      url.searchParams.set("entityId", entityId);
      url.searchParams.set("parentId", "null");
      url.searchParams.set("page", String(page + 1));
      url.searchParams.set("pageSize", String(COMMENTS_PAGE_SIZE));
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        comments: CommentRecord[];
        hasMore: boolean;
        userReactions: Record<string, string>;
      };
      setComments((prev) => [...prev, ...data.comments]);
      setHasMore(data.hasMore);
      setPage((p) => p + 1);
      setReactionMap((prev) => {
        const map = new Map(prev);
        for (const [id, kind] of Object.entries(data.userReactions)) {
          if (isReactionKind(kind)) map.set(id, kind);
        }
        return map;
      });
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoadingMore(false);
    }
  }

  function updateOne(next: CommentRecord) {
    setComments((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }

  // Seeded comments (held by the parent across our mount cycles) are merged
  // in front of the fetched/local list, deduped by id.
  const merged = useMemo(() => {
    const seeds = seedComments ?? [];
    if (seeds.length === 0) return comments;
    const seen = new Set(comments.map((c) => c.id));
    const seedsToPrepend = seeds.filter((s) => !seen.has(s.id));
    if (seedsToPrepend.length === 0) return comments;
    return [...seedsToPrepend, ...comments];
  }, [seedComments, comments]);

  return (
    <div className="space-y-4">
      {!readOnly && (
        <CommentForm
          entityType={entityType}
          entityId={entityId}
          parentId={null}
          itemMeta={itemMeta}
          signedIn={signedIn}
          onCreated={(c) => {
            setComments((prev) =>
              prev.some((p) => p.id === c.id) ? prev : [c, ...prev],
            );
            onCommentCreated?.(c);
          }}
        />
      )}

      {merged.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-5" />}
          title={t("empty")}
          description={signedIn ? t("emptyPrompt") : undefined}
        />
      ) : (
        <div className="comment-thread">
          {merged.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              entityType={entityType}
              entityId={entityId}
              itemMeta={itemMeta}
              currentUid={currentUid}
              signedIn={signedIn}
              userKind={reactionMap.get(c.id) ?? null}
              allowReplies
              onUpdate={updateOne}
              onSignInRequired={handleSignInRequired}
              onFlag={(id) => setFlagging(id)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button size="sm" variant="secondary" onClick={loadMore} disabled={loadingMore}>
            {tActions("loadMore")}
          </Button>
        </div>
      )}

      <FlagCommentDialog
        commentId={flagging}
        onClose={() => setFlagging(null)}
        onFlagged={(autoHidden) => {
          if (!autoHidden || !flagging) return;
          const target = comments.find((c) => c.id === flagging);
          if (target) updateOne({ ...target, status: "auto_hidden" });
        }}
      />
    </div>
  );
}
