"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flag, MoreHorizontal, Pencil, Reply, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { cn, formatRelative, initials } from "@/lib/utils";
import {
  deleteCommentAction,
  editCommentAction,
} from "@/app/[locale]/(site)/comments-actions";
import {
  MAX_COMMENT_LENGTH,
  type CommentEntityType,
  type CommentItemMeta,
  type CommentReactionCounts,
  type CommentReactionKind,
  type CommentRecord,
} from "@/types/comments";
import { CommentReactions } from "@/components/comments/CommentReactions";
import { CommentForm } from "@/components/comments/CommentForm";
import { CommentReplyList } from "@/components/comments/CommentReplyList";
import { linkifyComment } from "@/components/comments/utils";

interface Props {
  comment: CommentRecord;
  entityType: CommentEntityType;
  entityId: string;
  itemMeta: CommentItemMeta;
  currentUid: string | null;
  signedIn: boolean;
  userKind: CommentReactionKind | null;
  /** Top-level only: replies are toggled inside the item. */
  allowReplies: boolean;
  onUpdate: (next: CommentRecord) => void;
  onSignInRequired: () => void;
  onFlag: (commentId: string) => void;
}

export function CommentItem({
  comment,
  entityType,
  entityId,
  itemMeta,
  currentUid,
  signedIn,
  userKind,
  allowReplies,
  onUpdate,
  onSignInRequired,
  onFlag,
}: Props) {
  const t = useTranslations("comments");
  const tActions = useTranslations("comments.actions");
  const locale = useLocale();

  const isOwner = currentUid != null && currentUid === comment.author.uid;
  const isDeleted = comment.status === "deleted";
  const isAutoHidden = comment.status === "auto_hidden";
  const isHidden = comment.status === "hidden";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [pending, startTransition] = useTransition();

  const [replyOpen, setReplyOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  // Replies the user just posted in this session — seeded into CommentReplyList
  // so they render immediately without waiting on a refetch (the API would
  // otherwise return them, but indexing race or a missing composite index can
  // mask them; this also avoids the mount-order race where a window event was
  // dispatched before the list's listener attached).
  const [seedReplies, setSeedReplies] = useState<CommentRecord[]>([]);
  const replyCount = comment.replyCount;

  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (editing) editTextareaRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(comment.body);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(comment.body);
  }

  function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed === comment.body) {
      setEditing(false);
      return;
    }
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      toast.error(t("errors.tooLong"));
      return;
    }
    startTransition(async () => {
      const r = await editCommentAction({ commentId: comment.id, body: trimmed });
      if (!r.ok) {
        if (r.reason === "unauthorized") onSignInRequired();
        else if (r.reason === "forbidden") toast.error(t("errors.notOwner"));
        else toast.error(r.error);
        return;
      }
      onUpdate(r.comment);
      setEditing(false);
      toast.success(t("savedToast"));
    });
  }

  function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      const r = await deleteCommentAction(comment.id);
      if (!r.ok) {
        if (r.reason === "unauthorized") onSignInRequired();
        else if (r.reason === "forbidden") toast.error(t("errors.notOwner"));
        else toast.error(r.error);
        return;
      }
      // Mark as deleted locally — admin might still want to see it elsewhere, but
      // the public thread shows a tombstone.
      onUpdate({ ...comment, status: "deleted", body: "" });
      toast.success(t("deletedToast"));
    });
  }

  function handleReactionsChange(next: {
    reactions: CommentReactionCounts;
    userKind: CommentReactionKind | null;
  }) {
    onUpdate({ ...comment, reactions: next.reactions });
    // userKind for this comment is owned by the parent list — but since
    // CommentReactions optimistically passes the next userKind back, we can
    // also surface it via onUpdate's metadata. We stash it via DOM-level
    // event below instead — kept on parent list keyed by id.
    const ev = new CustomEvent("comments:user-kind", {
      detail: { id: comment.id, kind: next.userKind },
    });
    if (typeof window !== "undefined") window.dispatchEvent(ev);
  }

  const bodyHtml = useMemo(() => linkifyComment(comment.body), [comment.body]);

  return (
    <article className="comment-card" data-comment-id={comment.id}>
      <Avatar className="comment-avatar">
        {comment.author.picture && (
          <AvatarImage src={comment.author.picture} alt={comment.author.name ?? ""} />
        )}
        <AvatarFallback>{initials(comment.author.name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <header className="comment-meta">
          <span className="comment-author">{comment.author.name ?? t("anonymousAuthor")}</span>
          <span aria-hidden>·</span>
          <span title={new Date(comment.createdAt).toLocaleString()}>
            {formatRelative(comment.createdAt, locale)}
          </span>
          {comment.editedAt && (
            <>
              <span aria-hidden>·</span>
              <span>{tActions("edited")}</span>
            </>
          )}
          {isAutoHidden && (
            <span className="ml-1 inline-flex items-center rounded-md border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">
              {t("statuses.auto_hidden")}
            </span>
          )}
          {isHidden && (
            <span className="ml-1 inline-flex items-center rounded-md border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-danger">
              {t("statuses.hidden")}
            </span>
          )}
        </header>

        {isDeleted ? (
          <p className="mt-1 text-sm italic text-muted-foreground">
            {t("deletedTombstone")}
          </p>
        ) : editing ? (
          <div className="mt-2 space-y-2">
            <textarea
              ref={editTextareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={MAX_COMMENT_LENGTH}
              className="comment-textarea"
              disabled={pending}
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={pending}>
                {tActions("cancel")}
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={pending || !draft.trim()}>
                {tActions("save")}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="comment-body"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}

        {!isDeleted && !editing && (
          <div className="comment-actions-row">
            <CommentReactions
              commentId={comment.id}
              reactions={comment.reactions}
              userKind={userKind}
              signedIn={signedIn}
              onChange={handleReactionsChange}
              onSignInRequired={onSignInRequired}
            />

            {allowReplies && (
              <button
                type="button"
                onClick={() => {
                  if (!signedIn) {
                    onSignInRequired();
                    return;
                  }
                  setReplyOpen((v) => !v);
                }}
                className="comment-icon-button"
              >
                <Reply className="size-3.5" />
                <span>{tActions("reply")}</span>
              </button>
            )}

            {isOwner ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="comment-icon-button ml-auto"
                    aria-label={tActions("more")}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={startEdit}>
                    <Pencil />
                    {tActions("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="danger" onClick={handleDelete}>
                    <Trash2 />
                    {tActions("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              signedIn && (
                <button
                  type="button"
                  onClick={() => onFlag(comment.id)}
                  className="comment-icon-button ml-auto"
                  aria-label={tActions("flag")}
                  title={tActions("flag")}
                >
                  <Flag className="size-3.5" />
                </button>
              )
            )}
          </div>
        )}

        {allowReplies && (
          <div className={cn(replyOpen || showReplies ? "comment-replies" : null)}>
            {replyOpen && (
              <div className="mb-3">
                <CommentForm
                  entityType={entityType}
                  entityId={entityId}
                  parentId={comment.id}
                  itemMeta={itemMeta}
                  signedIn={signedIn}
                  replyMode
                  autoFocus
                  onCancel={() => setReplyOpen(false)}
                  onCreated={(reply) => {
                    setReplyOpen(false);
                    setShowReplies(true);
                    setSeedReplies((prev) =>
                      prev.some((r) => r.id === reply.id) ? prev : [reply, ...prev],
                    );
                    onUpdate({ ...comment, replyCount: comment.replyCount + 1 });
                  }}
                />
              </div>
            )}

            {replyCount > 0 && (
              <button
                type="button"
                onClick={() => setShowReplies((v) => !v)}
                className="comment-icon-button"
              >
                {showReplies
                  ? tActions("hideReplies")
                  : tActions("viewReplies", { count: replyCount })}
              </button>
            )}

            {showReplies && (
              <CommentReplyList
                entityType={entityType}
                entityId={entityId}
                parentId={comment.id}
                itemMeta={itemMeta}
                currentUid={currentUid}
                signedIn={signedIn}
                seedReplies={seedReplies}
                onSignInRequired={onSignInRequired}
                onFlag={onFlag}
              />
            )}
          </div>
        )}
      </div>
    </article>
  );
}
