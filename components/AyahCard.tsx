import { Heart, MessageCircle } from "lucide-react";
import type { Verse } from "@/types/quran";
import {
  QURAN_TRANSLATION_IDS,
  QURAN_TRANSLATION_NAMES,
  LANG_LABELS,
} from "@/lib/translations";
import type { LangCode } from "@/lib/translations";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import {
  NoteEditor,
  NoteEditorPanel,
  NoteEditorTrigger,
} from "@/components/site/NoteEditor";
import { AyahCommentsButton } from "@/components/comments/AyahCommentsButton";
import { AyahActionsRow } from "@/components/AyahActionsRow";

function stripHtml(s: string): string {
  // Translations from quran.com may contain <sup foot_note="...">N</sup> footnote markers.
  return s.replace(/<[^>]+>/g, "").trim();
}

export function AyahCard({
  verse,
  langs,
  surahId,
  surahName,
  locale,
  signedIn,
  currentUid = null,
  commentCount = 0,
  favoriteCount = 0,
}: {
  verse: Verse;
  langs: LangCode[];
  surahId: number;
  surahName: string;
  locale: string;
  signedIn: boolean;
  currentUid?: string | null;
  commentCount?: number;
  favoriteCount?: number;
}) {
  const nonArabic = langs.filter((l) => l !== "ar");

  // First non-Arabic translation, used as a short subtitle in favorites/notes.
  let excerpt: string | null = null;
  for (const lang of nonArabic) {
    const id = QURAN_TRANSLATION_IDS[lang];
    if (id == null) continue;
    const t = verse.translations.find((tr) => tr.resource_id === id);
    if (t) {
      excerpt = stripHtml(t.text);
      break;
    }
  }

  const itemMeta = {
    title: `${surahName} ${verse.verse_key}`,
    subtitle: excerpt ? excerpt.slice(0, 160) : null,
    href: `/quran/${surahId}#${verse.verse_key}`,
    arabic: verse.text_uthmani,
    locale,
  };

  return (
    <article
      id={verse.verse_key}
      className="border-b border-border bg-background py-4 scroll-mt-24 sm:py-5"
      data-ayah-id={verse.verse_key}
      data-surah={surahId}
      data-ayah={verse.verse_number}
    >
      <NoteEditor
        itemType="ayah"
        itemId={verse.verse_key}
        itemMeta={itemMeta}
        signedIn={signedIn}
      >
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
              {verse.verse_key}
            </span>
            {(favoriteCount > 0 || commentCount > 0) && (
              <span className="hidden md:inline-flex items-center gap-2 text-xs text-muted-foreground">
                {favoriteCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3.5" />
                    <span className="tabular-nums">{favoriteCount}</span>
                  </span>
                )}
                {commentCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="size-3.5" />
                    <span className="tabular-nums">{commentCount}</span>
                  </span>
                )}
              </span>
            )}
          </div>
          <AyahActionsRow
            triggerLabel={`${surahName} ${verse.verse_key} actions`}
            desktop={
              <>
                <NoteEditorTrigger />
                <AyahCommentsButton
                  surahId={surahId}
                  ayahNumber={verse.verse_number}
                  surahName={surahName}
                  locale={locale}
                  signedIn={signedIn}
                  currentUid={currentUid}
                  initialCount={commentCount}
                />
                <FavoriteButton
                  itemType="ayah"
                  itemId={verse.verse_key}
                  itemMeta={itemMeta}
                  signedIn={signedIn}
                  iconOnly
                  count={favoriteCount}
                />
              </>
            }
            mobile={
              <>
                <NoteEditorTrigger className="w-full justify-start" />
                <AyahCommentsButton
                  surahId={surahId}
                  ayahNumber={verse.verse_number}
                  surahName={surahName}
                  locale={locale}
                  signedIn={signedIn}
                  currentUid={currentUid}
                  initialCount={commentCount}
                  className="w-full justify-start"
                />
                <FavoriteButton
                  itemType="ayah"
                  itemId={verse.verse_key}
                  itemMeta={itemMeta}
                  signedIn={signedIn}
                  className="w-full justify-start"
                  count={favoriteCount}
                />
              </>
            }
          />
        </header>

        {langs.includes("ar") && (
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic text-2xl leading-loose text-foreground sm:text-3xl"
          >
            {verse.text_uthmani}
          </p>
        )}

        {nonArabic.length > 0 && (
          <div className="mt-4 space-y-4">
            {nonArabic.map((lang) => {
              const id = QURAN_TRANSLATION_IDS[lang];
              if (id == null) return null;
              const t = verse.translations.find((tr) => tr.resource_id === id);
              if (!t) return null;
              const label = LANG_LABELS[lang] ?? lang.toUpperCase();
              const translator = QURAN_TRANSLATION_NAMES[lang];
              return (
                <div key={lang} className="border-l-2 border-border pl-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                    {translator ? ` · ${translator}` : ""}
                  </div>
                  <p className="text-base leading-relaxed">{stripHtml(t.text)}</p>
                </div>
              );
            })}
          </div>
        )}

        <NoteEditorPanel />
      </NoteEditor>
    </article>
  );
}
