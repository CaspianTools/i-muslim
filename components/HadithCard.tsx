import type { HadithEntry } from "@/types/hadith";
import { LANG_LABELS } from "@/lib/translations";
import type { LangCode } from "@/lib/translations";

export type HadithTranslationSlice = {
  requested: LangCode;
  actual: LangCode | null;
  entry: HadithEntry | null;
  fallback: boolean;
};

export function HadithCard({
  number,
  arabic,
  translations,
  collectionShortName,
}: {
  number: number;
  arabic: HadithEntry | null;
  translations: HadithTranslationSlice[];
  collectionShortName: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-background p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {collectionShortName} · #{number}
        </span>
        {arabic?.grades && arabic.grades.length > 0 && (
          <span
            className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            title={arabic.grades.map((g) => `${g.name}: ${g.grade}`).join("; ")}
          >
            {arabic.grades[0].grade}
          </span>
        )}
      </header>

      {arabic && (
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-xl leading-loose text-foreground sm:text-2xl"
        >
          {arabic.text}
        </p>
      )}

      {translations.length > 0 && (
        <div className="mt-4 space-y-4">
          {translations.map(({ requested, actual, entry, fallback }) => (
            <div
              key={requested}
              className="border-l-2 border-border pl-4"
            >
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>{LANG_LABELS[requested] ?? requested.toUpperCase()}</span>
                {fallback && actual && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
                    {LANG_LABELS[requested] ?? requested.toUpperCase()} unavailable — showing{" "}
                    {LANG_LABELS[actual] ?? actual.toUpperCase()}
                  </span>
                )}
                {!entry && !fallback && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
                    translation unavailable
                  </span>
                )}
              </div>
              {entry ? (
                <p className="text-base leading-relaxed">{entry.text}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
