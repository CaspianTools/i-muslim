import type { Verse } from "@/types/quran";
import {
  QURAN_TRANSLATION_IDS,
  QURAN_TRANSLATION_NAMES,
  LANG_LABELS,
} from "@/lib/translations";
import type { LangCode } from "@/lib/translations";

function stripHtml(s: string): string {
  // Translations from quran.com may contain <sup foot_note="...">N</sup> footnote markers.
  return s.replace(/<[^>]+>/g, "").trim();
}

export function AyahCard({ verse, langs }: { verse: Verse; langs: LangCode[] }) {
  const nonArabic = langs.filter((l) => l !== "ar");

  return (
    <article className="rounded-xl border border-border bg-background p-5">
      <header className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
          {verse.verse_key}
        </span>
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
    </article>
  );
}
