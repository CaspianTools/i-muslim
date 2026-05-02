import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchSurahWithAyahs } from "@/lib/admin/data/quran";
import { AyahList } from "@/components/admin/quran/AyahList";
import { getGeminiConfigStatus } from "@/lib/admin/data/secrets";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";

export const dynamic = "force-dynamic";

export default async function AdminSurahPage({
  params,
}: {
  params: Promise<{ surah: string }>;
}) {
  const { surah: surahParam } = await params;
  const num = Number(surahParam);
  if (!Number.isInteger(num) || num < 1 || num > 114) notFound();

  const [{ surah, ayahs }, geminiStatus, languageSettings] = await Promise.all([
    fetchSurahWithAyahs(num),
    getGeminiConfigStatus(),
    getLanguageSettings(),
  ]);
  if (!surah) notFound();

  const availableLangs = languageSettings.quranEnabled.filter((l) => l !== "ar");

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <Link
            href="/admin/quran"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← All surahs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Surah {surah.number} · {surah.name_en}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {surah.name_translated} · {surah.ayah_count} ayahs ·{" "}
            <span className="capitalize">{surah.revelation_place}</span>
          </p>
        </div>
        <p dir="rtl" lang="ar" className="font-arabic text-3xl">
          {surah.name_ar}
        </p>
      </div>

      {ayahs.length === 0 ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm">
          No ayahs found for this surah. Run <code>npm run seed:quran</code> to
          populate the database.
        </div>
      ) : (
        <AyahList
          ayahs={ayahs}
          surah={num}
          availableLangs={availableLangs}
          aiConfigured={geminiStatus.configured}
        />
      )}
    </div>
  );
}
