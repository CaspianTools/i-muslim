"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { toast } from "@/components/ui/sonner";
import {
  upsertNoteAction,
  deleteNoteAction,
} from "@/app/[locale]/(site)/profile/notes-actions";
import { MAX_NOTE_LENGTH, type NoteRecord } from "@/types/notes";
import { formatRelative } from "@/lib/utils";

interface Props {
  note: NoteRecord;
}

export function ProfileNoteRow({ note }: Props) {
  const router = useRouter();
  const t = useTranslations("profileNotes");
  const tn = useTranslations("notes");
  const tFav = useTranslations("favorites");
  const locale = useLocale();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [text, setText] = useState(note.text);
  const [updatedAt, setUpdatedAt] = useState(note.updatedAt);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(text);
    setEditing(true);
  }

  function cancel() {
    setDraft(text);
    setEditing(false);
  }

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      remove();
      return;
    }
    if (trimmed.length > MAX_NOTE_LENGTH) {
      toast.error(tn("tooLong"));
      return;
    }
    startTransition(async () => {
      try {
        const result = await upsertNoteAction({
          itemType: note.itemType,
          itemId: note.itemId,
          itemMeta: note.itemMeta,
          text: trimmed,
        });
        if (!result.ok) {
          toast.error(tn("saveFailed"));
          return;
        }
        setText(result.note.text);
        setUpdatedAt(result.note.updatedAt);
        setEditing(false);
        toast.success(tn("savedToast"));
      } catch {
        toast.error(tn("saveFailed"));
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const result = await deleteNoteAction(note.id);
        if (!result.ok) {
          toast.error(tn("deleteFailed"));
          return;
        }
        toast.success(tn("deletedToast"));
        router.refresh();
      } catch {
        toast.error(tn("deleteFailed"));
      }
    });
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {t(`tabs.${note.itemType}`)}
          </span>
          <h2 className="mt-0.5 truncate text-base font-medium text-foreground">
            {note.itemMeta.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              disabled={pending}
              aria-label={t("edit")}
              title={t("edit")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <Pencil className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={tFav("remove")}
            title={tFav("remove")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {note.itemMeta.subtitle && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {note.itemMeta.subtitle}
        </p>
      )}
      {note.itemMeta.arabic && (
        <p
          dir="rtl"
          lang="ar"
          className="mt-2 line-clamp-1 font-arabic text-base text-foreground/80"
        >
          {note.itemMeta.arabic}
        </p>
      )}

      <div className="mt-3">
        {editing ? (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_NOTE_LENGTH}
              rows={4}
              placeholder={tn("placeholder")}
              disabled={pending}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {tn("charLimit", { count: draft.length, max: MAX_NOTE_LENGTH })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={pending}
                  className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {t("save")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="note-callout">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {text}
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{tn("editedAt", { when: formatRelative(updatedAt, locale) })}</span>
        <Link
          href={note.itemMeta.href}
          className="inline-flex items-center gap-0.5 text-primary hover:underline"
        >
          {t("open")}
          <ChevronRight className="size-3" />
        </Link>
      </div>
    </li>
  );
}
