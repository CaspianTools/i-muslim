"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import {
  upsertNoteAction,
  deleteNoteAction,
} from "@/app/[locale]/(site)/profile/notes-actions";
import { useNotesContext } from "@/components/site/notes/NotesContext";
import {
  MAX_NOTE_LENGTH,
  type NoteItemMeta,
  type NoteItemType,
} from "@/types/notes";
import { formatRelative, cn } from "@/lib/utils";

interface Props {
  itemType: NoteItemType;
  itemId: string;
  itemMeta: NoteItemMeta;
  signedIn: boolean;
  className?: string;
}

/**
 * Always-open note editor. Same store + actions as the in-card NoteEditor —
 * any edits flow through useNotesContext so the card and the tab stay in
 * sync. Used in the per-hadith permalink page's Notes tab, where the editor
 * is the primary surface rather than a card-header toggle.
 */
export function InlineNoteEditor({
  itemType,
  itemId,
  itemMeta,
  signedIn,
  className,
}: Props) {
  const provider = useNotesContext();
  const note = provider?.get(itemType, itemId) ?? null;
  const [draft, setDraft] = useState<string>(note?.text ?? "");
  const [pending, startTransition] = useTransition();
  const t = useTranslations("notes");
  const tPage = useTranslations("hadithPage");
  const locale = useLocale();

  if (!signedIn) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/30 p-4 text-sm", className)}>
        <p className="text-muted-foreground">
          {tPage("singleNotesSignInPrompt")}
        </p>
        <Link
          href="/login"
          className="mt-3 inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {tPage("singleNotesSignInLink")}
        </Link>
      </div>
    );
  }

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (note) remove();
      return;
    }
    if (trimmed.length > MAX_NOTE_LENGTH) {
      toast.error(t("tooLong"));
      return;
    }
    const previous = note;
    const optimistic = {
      id: note?.id ?? "__pending__",
      text: trimmed,
      updatedAt: new Date().toISOString(),
    };
    provider?.set(itemType, itemId, optimistic);

    startTransition(async () => {
      try {
        const result = await upsertNoteAction({
          itemType,
          itemId,
          itemMeta,
          text: trimmed,
        });
        if (!result.ok) {
          provider?.set(itemType, itemId, previous);
          if (result.reason === "too_long") toast.error(t("tooLong"));
          else toast.error(t("saveFailed"));
          return;
        }
        provider?.set(itemType, itemId, {
          id: result.note.id,
          text: result.note.text,
          updatedAt: result.note.updatedAt,
        });
        toast.success(t("savedToast"));
      } catch {
        provider?.set(itemType, itemId, previous);
        toast.error(t("saveFailed"));
      }
    });
  }

  function remove() {
    const previous = note;
    if (!previous || previous.id === "__pending__") {
      provider?.set(itemType, itemId, null);
      setDraft("");
      return;
    }
    provider?.set(itemType, itemId, null);
    setDraft("");

    startTransition(async () => {
      try {
        const result = await deleteNoteAction(previous.id);
        if (!result.ok) {
          provider?.set(itemType, itemId, previous);
          setDraft(previous.text);
          toast.error(t("deleteFailed"));
          return;
        }
        toast.success(t("deletedToast"));
      } catch {
        provider?.set(itemType, itemId, previous);
        setDraft(previous.text);
        toast.error(t("deleteFailed"));
      }
    });
  }

  const hasNote = Boolean(note);
  const dirty = draft.trim() !== (note?.text ?? "");

  return (
    <div className={cn("rounded-lg border border-border bg-muted/30 p-3", className)}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{t("yourNote")}</span>
        {hasNote && note && (
          <span>{t("editedAt", { when: formatRelative(note.updatedAt, locale) })}</span>
        )}
      </div>
      <label className="sr-only" htmlFor={`inline-note-${itemType}-${itemId}`}>
        {t("yourNote")}
      </label>
      <textarea
        id={`inline-note-${itemType}-${itemId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        rows={5}
        placeholder={t("placeholder")}
        disabled={pending}
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("charLimit", { count: draft.length, max: MAX_NOTE_LENGTH })}
        </span>
        <div className="flex items-center gap-2">
          {hasNote && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex h-8 items-center rounded-md px-3 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
            >
              {t("deleteNote")}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {t("saveNote")}
          </button>
        </div>
      </div>
    </div>
  );
}
