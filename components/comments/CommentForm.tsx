"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { createCommentAction } from "@/app/[locale]/(site)/comments-actions";
import {
  MAX_COMMENT_LENGTH,
  type CommentEntityType,
  type CommentItemMeta,
  type CommentRecord,
} from "@/types/comments";

interface Props {
  entityType: CommentEntityType;
  entityId: string;
  parentId: string | null;
  itemMeta: CommentItemMeta;
  signedIn: boolean;
  onCreated: (comment: CommentRecord) => void;
  onCancel?: () => void;
  signedOutSlot?: ReactNode;
  autoFocus?: boolean;
  placeholder?: string;
  /** When true, submit button label is "Reply" instead of "Post". */
  replyMode?: boolean;
}

export function CommentForm({
  entityType,
  entityId,
  parentId,
  itemMeta,
  signedIn,
  onCreated,
  onCancel,
  signedOutSlot,
  autoFocus,
  placeholder,
  replyMode,
}: Props) {
  const t = useTranslations("comments");
  const tCommon = useTranslations("common");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  if (!signedIn) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        {signedOutSlot ?? t("signInPrompt")}
      </div>
    );
  }

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      toast.error(t("errors.tooLong"));
      return;
    }
    startTransition(async () => {
      const r = await createCommentAction({
        entityType,
        entityId,
        parentId,
        body: trimmed,
        itemMeta,
      });
      if (!r.ok) {
        if (r.reason === "unauthorized") toast.error(t("errors.signInRequired"));
        else if (r.reason === "too_long") toast.error(t("errors.tooLong"));
        else toast.error(r.error);
        return;
      }
      setBody("");
      onCreated(r.comment);
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={replyMode ? 2 : 3}
        maxLength={MAX_COMMENT_LENGTH}
        placeholder={placeholder ?? t("placeholder")}
        className="comment-textarea"
        disabled={pending}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {body.length}/{MAX_COMMENT_LENGTH}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
              {tCommon("cancel")}
            </Button>
          )}
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            {replyMode ? t("actions.reply") : t("actions.post")}
          </Button>
        </div>
      </div>
    </div>
  );
}
