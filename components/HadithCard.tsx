import Link from "next/link";
import { ExternalLink, Info, MessageSquare, StickyNote } from "lucide-react";
import type { HadithEntry } from "@/types/hadith";
import { LANG_LABELS } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import {
  NoteEditor,
  NoteEditorPanel,
  NoteEditorTrigger,
} from "@/components/site/NoteEditor";
import { HadithCommentsButton } from "@/components/comments/HadithCommentsButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type HadithTranslationSlice = {
  requested: LangCode;
  actual: LangCode | null;
  entry: HadithEntry | null;
  fallback: boolean;
  // "in_process" means a translation exists in the requested language but is
  // still in Draft — render a placeholder, never the unreviewed text.
  status?: "in_process";
};

export function HadithCard({
  number,
  arabic,
  translations,
  collectionShortName,
  collectionId,
  collectionName,
  bookNumber,
  bookName,
  locale,
  signedIn,
  currentUid = null,
  commentCount = 0,
  permalink = false,
  permalinkLabel,
  interactionMode = "popup",
  tabsAnchorId = "hadith-tabs",
}: {
  number: number;
  arabic: HadithEntry | null;
  translations: HadithTranslationSlice[];
  collectionShortName: string;
  collectionId: string;
  collectionName: string;
  bookNumber: number;
  bookName: string;
  locale: string;
  signedIn: boolean;
  currentUid?: string | null;
  commentCount?: number;
  // When true, render an "Open" link in the card header pointing to the
  // hadith's own permalink page. Used on the book page; never set on the
  // permalink page itself (it would link to itself).
  permalink?: boolean;
  permalinkLabel?: string;
  // "popup" (default): Notes trigger opens an in-card editor; Comments
  // icon opens a modal popup. Used everywhere except the permalink page.
  // "scroll-to-tab": both icons become anchor links that jump to the tab
  // section below the card and flip the active tab. The in-card notes
  // panel is suppressed since the editor lives in the tab.
  interactionMode?: "popup" | "scroll-to-tab";
  tabsAnchorId?: string;
}) {
  // First non-empty translation, used as a short subtitle in favorites/notes.
  const excerptEntry = translations.find((t) => t.entry?.text)?.entry?.text ?? null;
  const excerpt = excerptEntry ? excerptEntry.slice(0, 160) : null;
  const itemId = `${collectionId}/${bookNumber}/${number}`;
  const itemMeta = {
    title: `${collectionName} — ${bookName} #${number}`,
    subtitle: excerpt,
    href: `/hadith/${collectionId}/${bookNumber}#hadith-${number}`,
    arabic: arabic?.text ?? null,
    locale,
  };

  return (
    <article
      id={`hadith-${number}`}
      className="rounded-xl border border-border bg-background p-5 scroll-mt-24"
      data-hadith-number={number}
      data-hadith-id={itemId}
    >
      <NoteEditor
        itemType="hadith"
        itemId={itemId}
        itemMeta={itemMeta}
        signedIn={signedIn}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {collectionShortName} · #{number}
          </span>
          <div className="flex items-center gap-2">
            {permalink && (
              <Link
                href={`/hadith/${collectionId}/${number}`}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={permalinkLabel ?? `Open hadith ${number}`}
              >
                <ExternalLink className="size-3.5" />
                <span className="hidden sm:inline">{permalinkLabel ?? "Open"}</span>
              </Link>
            )}
            {arabic?.grades && arabic.grades.length > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                title={arabic.grades.map((g) => `${g.name}: ${g.grade}`).join("; ")}
              >
                {arabic.grades[0].grade}
              </span>
            )}
            {interactionMode === "scroll-to-tab" ? (
              <>
                <a
                  href="#notes"
                  data-hadith-scroll-target={tabsAnchorId}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Notes"
                  title="Notes"
                >
                  <StickyNote className="size-4" />
                </a>
                <a
                  href="#comments"
                  data-hadith-scroll-target={tabsAnchorId}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Comments (${commentCount})`}
                  title="Comments"
                >
                  <MessageSquare className="size-4" />
                  {commentCount > 0 && <span>{commentCount}</span>}
                </a>
              </>
            ) : (
              <>
                <NoteEditorTrigger />
                <HadithCommentsButton
                  collectionId={collectionId}
                  bookNumber={bookNumber}
                  hadithNumber={number}
                  reference={`${collectionName} — ${bookName} #${number}`}
                  locale={locale}
                  signedIn={signedIn}
                  currentUid={currentUid}
                  initialCount={commentCount}
                />
              </>
            )}
            <FavoriteButton
              itemType="hadith"
              itemId={itemId}
              itemMeta={itemMeta}
              signedIn={signedIn}
              iconOnly
            />
          </div>
        </header>

        {arabic && (
        <p
          dir="rtl"
          lang="ar"
          style={{ fontSize: "var(--reader-arabic-size)" }}
          className="font-arabic leading-loose text-foreground"
        >
          {arabic.text}
        </p>
      )}

      {translations.length > 0 && (
        <div className="mt-4 space-y-4">
          {translations.map(({ requested, actual, entry, fallback, status }) => (
            <div
              key={requested}
              className="border-l-2 border-border pl-4"
            >
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>{LANG_LABELS[requested] ?? requested.toUpperCase()}</span>
                {/* Status badges are now compact (i) tooltips so the hadith
                    list isn't cluttered with inline review-status copy on
                    every card. The full text shows on hover (desktop) or
                    tap (mobile). */}
                {status === "in_process" && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Translation under review"
                          className="inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Translation under review</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {status !== "in_process" && fallback && actual && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${LANG_LABELS[requested] ?? requested.toUpperCase()} unavailable — showing ${LANG_LABELS[actual] ?? actual.toUpperCase()}`}
                          className="inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <Info className="size-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {LANG_LABELS[requested] ?? requested.toUpperCase()} unavailable
                        — showing {LANG_LABELS[actual] ?? actual.toUpperCase()}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {status !== "in_process" && !entry && !fallback && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
                    translation unavailable
                  </span>
                )}
              </div>
              {status === "in_process" ? null : entry ? (
                <p
                  style={{ fontSize: "var(--reader-translation-size)" }}
                  className="leading-relaxed"
                >
                  {entry.text}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

        {interactionMode === "popup" && <NoteEditorPanel />}
      </NoteEditor>
    </article>
  );
}
