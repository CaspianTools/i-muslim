"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { BookOpenText, ChevronUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TafsirText } from "@/components/site/tafsir/TafsirText";
import { isEditorialNote } from "@/lib/tafsir/render";
import type { TafsirLang } from "@/lib/tafsir/works";
import { cn } from "@/lib/utils";

// Inline tafsir for one ayah, mirroring the NoteEditor / NoteEditorTrigger /
// NoteEditorPanel trio: a client provider wraps server-rendered card children,
// and the trigger and panel talk to each other through context.
//
// The text is fetched on first expand and never eagerly. Al-Baqarah's Arabic
// commentary is 3.2 MB across 178 blocks — inlining it into the surah page's
// HTML is not survivable on a 512 MiB instance.

/** Everything the card knows before any fetch — resolved from the committed index. */
export type TafsirBlockHint = {
  workId: string;
  lang: TafsirLang;
  surah: number;
  ayah: number;
  slug: string;
  /** Display label for the ayahs the block covers, e.g. "155–162". */
  coverage: string;
  /** True when the block spans more than the current ayah. */
  multiAyah: boolean;
  href: string;
};

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string; siteNotice: string | null; attribution: string }
  | { status: "error" };

type Ctx = {
  hint: TafsirBlockHint;
  open: boolean;
  state: FetchState;
  panelId: string;
  toggle: (slot: "desktop" | "mobile") => void;
  close: () => void;
  retry: () => void;
  /**
   * Bumped on every expand. The panel keeps its own DOM ref and focuses itself
   * when this changes — refs stay inside the component that owns them, in an
   * effect, which is what react-hooks/refs requires. Putting a RefObject on the
   * context instead makes every `ctx.*` read look like a ref access at render.
   */
  openedAt: number;
};

const TafsirCtx = createContext<Ctx | null>(null);

function useTafsir(): Ctx | null {
  return useContext(TafsirCtx);
}

export function TafsirDisclosure({
  hint,
  children,
}: {
  /** null when this ayah has no tafsir in the active language, or tafsir is off. */
  hint: TafsirBlockHint | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(0);
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const lastSlot = useRef<"desktop" | "mobile">("desktop");

  const panelId = hint ? `tafsir-panel-${hint.surah}-${hint.ayah}` : "";

  const load = useCallback(async () => {
    if (!hint) return;
    setState({ status: "loading" });
    try {
      const res = await fetch(
        `/api/tafsir/${hint.workId}/${hint.lang}/${hint.surah}/${hint.ayah}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        text: string;
        siteNotice: string | null;
        attribution: string;
      };
      setState({
        status: "ready",
        text: data.text,
        siteNotice: data.siteNotice,
        attribution: data.attribution,
      });
    } catch {
      setState({ status: "error" });
    }
  }, [hint]);

  const toggle = useCallback(
    (slot: "desktop" | "mobile") => {
      lastSlot.current = slot;
      setOpen((wasOpen) => {
        const next = !wasOpen;
        if (next) {
          setOpenedAt((n) => n + 1);
          setState((s) => {
            if (s.status === "idle" || s.status === "error") void load();
            return s.status === "ready" ? s : { status: "loading" };
          });
        }
        return next;
      });
    },
    [load],
  );

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to whichever trigger opened the panel. Both the desktop row
    // and the mobile popover mount simultaneously, so the wrong one would be
    // invisible.
    const el = document.getElementById(`tafsir-trigger-${lastSlot.current}-${panelId}`);
    el?.focus();
  }, [panelId]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const value = useMemo<Ctx>(
    () => ({
      hint: hint as TafsirBlockHint,
      open,
      state,
      panelId,
      toggle,
      close,
      retry,
      openedAt,
    }),
    [hint, open, state, panelId, toggle, close, retry, openedAt],
  );

  // No coverage for this ayah — render the card untouched so there is never a
  // dead control.
  if (!hint) return <>{children}</>;

  return <TafsirCtx.Provider value={value}>{children}</TafsirCtx.Provider>;
}

export function TafsirTrigger({
  slot,
  className,
}: {
  /** Both AyahActionsRow subtrees mount, so ids must differ or the DOM is invalid. */
  slot: "desktop" | "mobile";
  className?: string;
}) {
  const ctx = useTafsir();
  const t = useTranslations("tafsir");
  if (!ctx) return null;

  const label = ctx.open ? t("hide") : t("show");
  // Match NoteEditorTrigger: show the text label in the full-width popover row,
  // stay icon-only inline on desktop.
  const showLabel = Boolean(className?.includes("justify-start"));

  return (
    <button
      type="button"
      id={`tafsir-trigger-${slot}-${ctx.panelId}`}
      onClick={() => ctx.toggle(slot)}
      aria-label={label}
      title={label}
      aria-expanded={ctx.open}
      aria-controls={ctx.panelId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border transition-colors h-8 px-2 text-xs",
        ctx.open ? "ui-selected-chip" : "ui-selected-chip-idle",
        className,
      )}
    >
      <BookOpenText className="size-4" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

export function TafsirPanel({ className }: { className?: string }) {
  const ctx = useTafsir();
  const t = useTranslations("tafsir");
  const panelRef = useRef<HTMLElement | null>(null);
  const openedAt = ctx?.openedAt ?? 0;
  const isOpen = ctx?.open ?? false;

  useEffect(() => {
    if (isOpen) panelRef.current?.focus({ preventScroll: true });
  }, [isOpen, openedAt]);

  if (!ctx || !ctx.open) return null;

  const { hint, state } = ctx;

  return (
    <section
      ref={panelRef}
      id={ctx.panelId}
      role="region"
      // aria-label, not aria-labelledby: one of the two triggers is always
      // inside a `hidden md:flex` container, and labelling from a hidden
      // element is unreliable across screen readers.
      aria-label={t("panelLabel", { verse: `${hint.surah}:${hint.ayah}` })}
      aria-busy={state.status === "loading"}
      tabIndex={-1}
      className={cn(
        "mt-4 rounded-lg border border-border bg-muted/30 p-4 focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("blockHeading", { coverage: `${hint.surah}:${hint.coverage}` })}
        </span>
        <Link
          href={hint.href}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t("openFullPage")}
        </Link>
      </div>

      {state.status === "loading" && (
        <>
          <span className="sr-only" role="status">
            {t("loading")}
          </span>
          <div className="space-y-2" aria-hidden="true">
            <div className="skeleton skeleton-line w-full" />
            <div className="skeleton skeleton-line w-11/12" />
            <div className="skeleton skeleton-line w-4/5" />
          </div>
        </>
      )}

      {state.status === "error" && (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{t("loadFailed")}</span>
          <button
            type="button"
            onClick={ctx.retry}
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs transition-colors hover:bg-muted"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {isEditorialNote(state.text, hint.lang) ? (
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("editorialNote")}
              </p>
              <p lang={hint.lang} className="mt-1.5 text-sm italic text-muted-foreground">
                {state.text}
              </p>
            </div>
          ) : (
            <TafsirText
              text={state.text}
              lang={hint.lang}
              honorificLabel={t("sallallahu")}
            />
          )}
          <p className="mt-4 border-t border-border pt-2 text-xs text-muted-foreground">
            {state.attribution}
            {state.siteNotice ? ` · ${state.siteNotice}` : ""}
          </p>
          <div className="mt-3 flex justify-end">
            {/* A long block is a long tab-trap; a keyboard user must not have to
                shift-tab back through all of it to close. */}
            <button
              type="button"
              onClick={ctx.close}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronUp className="size-3.5" />
              {t("hide")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
