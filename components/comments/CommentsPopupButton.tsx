"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import {
  EditorDialog,
  EditorDialogBody,
  EditorDialogContent,
  EditorDialogHeader,
  EditorDialogTitle,
  EditorDialogTrigger,
} from "@/components/ui/editor-dialog";
import { CommentList } from "@/components/comments/CommentList";
import { toast } from "@/components/ui/sonner";
import {
  COMMENTS_PAGE_SIZE,
  isReactionKind,
  type CommentEntityType,
  type CommentItemMeta,
  type CommentReactionKind,
  type CommentRecord,
} from "@/types/comments";
import { cn } from "@/lib/utils";

interface Props {
  entityType: CommentEntityType;
  entityId: string;
  itemMeta: CommentItemMeta;
  signedIn: boolean;
  currentUid: string | null;
  initialCount: number;
  /** Header label shown above the popup thread, e.g. "Al-Fatihah 1:1". */
  dialogTitle: string;
  /** Optional accessible label override for the trigger button. */
  triggerAriaLabel?: string;
  className?: string;
  /** Optional render override for the trigger contents. */
  triggerSlot?: ReactNode;
}

interface ApiResponse {
  comments: CommentRecord[];
  hasMore: boolean;
  page: number;
  pageSize: number;
  userReactions: Record<string, string>;
}

/**
 * Compact trigger that opens a popup containing the full comment thread for
 * an entity. Used wherever inline threads would be too noisy (per-ayah on a
 * surah page, per-hadith on a book page). Shows a count badge when there is
 * at least one comment. Loads the first page lazily on first open.
 */
export function CommentsPopupButton({
  entityType,
  entityId,
  itemMeta,
  signedIn,
  currentUid,
  initialCount,
  dialogTitle,
  triggerAriaLabel,
  className,
  triggerSlot,
}: Props) {
  const t = useTranslations("comments");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  // Comments the user just posted in this popup session — kept here so they
  // survive the dialog close/reopen cycle (CommentList itself unmounts and
  // loses its local state). They're rendered alongside the fetched page,
  // deduped by id, so the just-posted comment shows whether or not the API
  // returns it (e.g. when the listComments composite index hasn't been
  // deployed yet, the API returns []).
  const [seedComments, setSeedComments] = useState<CommentRecord[]>([]);
  const count = initialCount;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/comments", window.location.origin);
      url.searchParams.set("entityType", entityType);
      url.searchParams.set("entityId", entityId);
      url.searchParams.set("parentId", "null");
      url.searchParams.set("pageSize", String(COMMENTS_PAGE_SIZE));
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("load failed");
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, t]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Refetch on every open so changes made elsewhere (other tabs, admin
    // moderation, etc.) are reflected. The previous "load only on first open"
    // gate cached an empty result and showed "Be the first to comment" even
    // after the user had posted.
    if (next) {
      void load();
    }
  }

  const initialUserReactions = data?.userReactions
    ? Object.fromEntries(
        Object.entries(data.userReactions).filter(([, v]) =>
          isReactionKind(v),
        ) as [string, CommentReactionKind][],
      )
    : {};

  const ariaLabel = triggerAriaLabel ?? t("popupButtonAria", { count });

  return (
    <EditorDialog open={open} onOpenChange={handleOpenChange}>
      <EditorDialogTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={ariaLabel}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border transition-colors h-8 px-2 text-xs",
            count > 0 ? "ui-selected-chip" : "ui-selected-chip-idle",
            className,
          )}
        >
          {triggerSlot ?? (
            <>
              <MessageCircle className="size-4" />
              {count > 0 && <span className="tabular-nums">{count}</span>}
            </>
          )}
        </button>
      </EditorDialogTrigger>
      <EditorDialogContent>
        <EditorDialogHeader>
          <EditorDialogTitle>{dialogTitle}</EditorDialogTitle>
        </EditorDialogHeader>
        <EditorDialogBody>
          {loading || !data ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("loading")}
            </div>
          ) : (
            <CommentList
              entityType={entityType}
              entityId={entityId}
              itemMeta={itemMeta}
              initialComments={data.comments}
              initialHasMore={data.hasMore}
              initialUserReactions={initialUserReactions}
              signedIn={signedIn}
              currentUid={currentUid}
              seedComments={seedComments}
              autoFocusForm
              onCommentCreated={(c) =>
                setSeedComments((prev) =>
                  prev.some((s) => s.id === c.id) ? prev : [c, ...prev],
                )
              }
            />
          )}
        </EditorDialogBody>
      </EditorDialogContent>
    </EditorDialog>
  );
}
