import { ArrowRight, BookOpenCheck, Library } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSiteSession } from "@/lib/auth/session";
import { getReadingProgress } from "@/lib/profile/data";
import { formatRelative } from "@/lib/utils";

/**
 * "Continue reading" card on the home page. Renders for signed-in users with
 * any prior Quran or Hadith reading state. Resumes from the most recent of
 * the two — if both are present, the more recently viewed wins. Returns null
 * for anonymous visitors and for new users without progress.
 *
 * Data layer is the existing `getReadingProgress(uid)` from
 * lib/profile/data.ts (already used on /profile/reading), so this component
 * adds zero new server work — the document is already cached for the
 * session by Firestore's read.
 */
export async function ContinueReading() {
  const session = await getSiteSession();
  if (!session) return null;

  const progress = await getReadingProgress(session.uid);
  const ayah = progress.lastQuranAyah;
  const hadith = progress.lastHadith;
  if (!ayah && !hadith) return null;

  // Resume from whichever was viewed most recently.
  const useAyah =
    !!ayah &&
    (!hadith ||
      new Date(ayah.viewedAt).getTime() >= new Date(hadith.viewedAt).getTime());

  const t = await getTranslations("home.continueReading");
  const tReading = await getTranslations("reading");

  if (useAyah && ayah) {
    return (
      <Link
        href={`/quran/${ayah.surah}#${ayah.verseKey}`}
        className="group mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent"
      >
        <span className="grid size-10 place-items-center rounded-lg bg-selected text-selected-foreground">
          <BookOpenCheck className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("heading")}
          </p>
          <p className="text-base font-semibold text-foreground">
            {tReading("lastQuranAyah")} · {ayah.verseKey}
          </p>
          <p className="text-xs text-muted-foreground">
            {tReading("viewedAt", { when: formatRelative(ayah.viewedAt) })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          {t("resume")}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
        </span>
      </Link>
    );
  }

  if (hadith) {
    return (
      <Link
        href={`/hadith/${hadith.collection}/${hadith.book}#hadith-${hadith.number}`}
        className="group mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent"
      >
        <span className="grid size-10 place-items-center rounded-lg bg-selected text-selected-foreground">
          <Library className="size-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("heading")}
          </p>
          <p className="text-base font-semibold text-foreground">
            {hadith.collection} · {tReading("lastHadith")} #{hadith.number}
          </p>
          <p className="text-xs text-muted-foreground">
            {tReading("viewedAt", { when: formatRelative(hadith.viewedAt) })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          {t("resume")}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
        </span>
      </Link>
    );
  }

  return null;
}
