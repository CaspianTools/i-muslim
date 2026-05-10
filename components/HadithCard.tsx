import { Info } from "lucide-react";
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
            {arabic?.grades && arabic.grades.length > 0 && (
              <span
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                title={arabic.grades.map((g) => `${g.name}: ${g.grade}`).join("; ")}
              >
                {arabic.grades[0].grade}
              </span>
            )}
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

        <NoteEditorPanel />
      </NoteEditor>
    </article>
  );
}
