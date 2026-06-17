import { getTranslations } from "next-intl/server";
import { getAyahOfTheDay } from "@/lib/quran/of-the-day";
import type { LangCode } from "@/lib/translations";

/**
 * Left-rail "verse of the day" card. Sources canonical Uthmani Arabic + a
 * translation in the viewer's locale from our seeded Quran data (deterministic
 * per day). Renders nothing if Quran data is unavailable.
 */
export async function VerseOfTheDayCard({ locale }: { locale: string }) {
  const t = await getTranslations("mosques.community");
  const verse = await getAyahOfTheDay(new Date(), (locale as LangCode) ?? "en");
  if (!verse) return null;

  return (
    <div className="mq-card mq-card-pad bg-selected/40">
      <div className="mq-rail-title">{t("verseTitle")}</div>
      <p dir="rtl" lang="ar" className="font-arabic text-right text-xl leading-relaxed text-foreground sm:leading-loose">
        {verse.arabic}
      </p>
      {verse.translation && (
        <p className="mt-2 font-display text-[0.95rem] italic leading-snug text-foreground">
          “{verse.translation}”
        </p>
      )}
      <p className="mt-2 text-xs tracking-wide text-muted-foreground">
        {t("verseCitation", { surah: verse.surahName, ayah: verse.ayah })}
      </p>
    </div>
  );
}
