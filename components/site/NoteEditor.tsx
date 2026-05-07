"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  upsertNoteAction,
  deleteNoteAction,
} from "@/app/[locale]/(site)/profile/notes-actions";
import {
  useNotesContext,
  type NoteState,
} from "@/components/site/notes/NotesContext";
import { MAX_NOTE_LENGTH, type NoteItemMeta, type NoteItemType } from "@/types/notes";
import { formatRelative, cn } from "@/lib/utils";

interface CardCtx {
  itemType: NoteItemType;
  itemId: string;
  note: NoteState | null;
  editing: boolean;
  pending: boolean;
  draft: string;
  setDraft: (s: string) => void;
  toggle: () => void;
  cancel: () => void;
  save: () => void;
  remove: () => void;
}

const NoteCardContext = createContext<CardCtx | null>(null);

function useCard(): CardCtx {
  const ctx = useContext(NoteCardContext);
  if (!ctx) {
    throw new Error("NoteEditorTrigger / NoteEditorPanel must be inside <NoteEditor>");
  }
  return ctx;
}

interface NoteEditorProps {
  itemType: NoteItemType;
  itemId: string;
  itemMeta: NoteItemMeta;
  signedIn?: boolean;
  /**
   * Initial note when no NotesProvider seed is available (rare — e.g. a
   * card outside a list page).
   */
  initialNote?: NoteState | null;
  children: ReactNode;
}

export function NoteEditor({
  itemType,
  itemId,
  itemMeta,
  signedIn = false,
  initialNote = null,
  children,
}: NoteEditorProps) {
  const provider = useNotesContext();
  const providerNote = provider?.get(itemType, itemId) ?? null;
  const [localNote, setLocalNote] = useState<NoteState | null>(initialNote);
  const note = provider ? providerNote : localNote;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.text ?? "");
  const [pending, startTransition] = useTransition();
  const t = useTranslations("notes");

  function syncNote(next: NoteState | null) {
    if (provider) provider.set(itemType, itemId, next);
    else setLocalNote(next);
  }

  function handleSignInGate() {
    toast.error(t("signInRequired"), {
      action: {
        label: t("signInCta"),
        onClick: () => {
          window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
        },
      },
    });
  }

  function cancel() {
    setEditing(false);
    setDraft(note?.text ?? "");
  }

  function toggle() {
    if (!signedIn) {
      handleSignInGate();
      return;
    }
    if (editing) {
      cancel();
      return;
    }
    setDraft(note?.text ?? "");
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (note) {
        remove();
      } else {
        setEditing(false);
      }
      return;
    }
    if (trimmed.length > MAX_NOTE_LENGTH) {
      toast.error(t("tooLong"));
      return;
    }
    const previous = note;
    const optimistic: NoteState = {
      id: note?.id ?? "__pending__",
      text: trimmed,
      updatedAt: new Date().toISOString(),
    };
    syncNote(optimistic);
    setEditing(false);

    startTransition(async () => {
      try {
        const result = await upsertNoteAction({
          itemType,
          itemId,
          itemMeta,
          text: trimmed,
        });
        if (!result.ok) {
          syncNote(previous);
          if (result.reason === "unauthorized") handleSignInGate();
          else if (result.reason === "too_long") toast.error(t("tooLong"));
          else toast.error(t("saveFailed"));
          return;
        }
        syncNote({
          id: result.note.id,
          text: result.note.text,
          updatedAt: result.note.updatedAt,
        });
        toast.success(t("savedToast"));
      } catch {
        syncNote(previous);
        toast.error(t("saveFailed"));
      }
    });
  }

  function remove() {
    const previous = note;
    if (!previous || previous.id === "__pending__") {
      syncNote(null);
      setEditing(false);
      return;
    }
    syncNote(null);
    setEditing(false);

    startTransition(async () => {
      try {
        const result = await deleteNoteAction(previous.id);
        if (!result.ok) {
          syncNote(previous);
          if (result.reason === "unauthorized") handleSignInGate();
          else toast.error(t("deleteFailed"));
          return;
        }
        toast.success(t("deletedToast"));
      } catch {
        syncNote(previous);
        toast.error(t("deleteFailed"));
      }
    });
  }

  const value = useMemo<CardCtx>(
    () => ({
      itemType,
      itemId,
      note,
      editing,
      pending,
      draft,
      setDraft,
      toggle,
      cancel,
      save,
      remove,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemType, itemId, note, editing, pending, draft],
  );

  return <NoteCardContext.Provider value={value}>{children}</NoteCardContext.Provider>;
}

export function NoteEditorTrigger({ className }: { className?: string }) {
  const { note, editing, pending, toggle } = useCard();
  const t = useTranslations("notes");
  const hasNote = Boolean(note);
  const label = hasNote ? t("editNote") : t("addNote");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={label}
      title={label}
      aria-pressed={editing}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border transition-colors h-8 px-2 text-xs",
        hasNote ? "ui-selected-chip" : "ui-selected-chip-idle",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      )}
    >
      <StickyNote className={cn("size-4", hasNote && "fill-current")} />
    </button>
  );
}

export function NoteEditorPanel({ className }: { className?: string }) {
  const { itemType, itemId, note, editing, pending, draft, setDraft, cancel, save, remove } =
    useCard();
  const t = useTranslations("notes");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const hasNote = Boolean(note);
  if (!hasNote && !editing) return null;

  return (
    <div className={cn("mt-4", className)} data-note-editor>
      {editing ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <label className="sr-only" htmlFor={`note-${itemType}-${itemId}`}>
            {t("yourNote")}
          </label>
          <textarea
            id={`note-${itemType}-${itemId}`}
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={4}
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
                onClick={cancel}
                disabled={pending}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {t("cancelNote")}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {t("saveNote")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        note && (
          <div className="note-callout">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wide">{t("yourNote")}</span>
              <span>{t("editedAt", { when: formatRelative(note.updatedAt) })}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {note.text}
            </p>
          </div>
        )
      )}
    </div>
  );
}
