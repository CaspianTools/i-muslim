import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { fetchSurahWithAyahs } from "@/lib/admin/data/quran";
import { AyahList } from "@/components/admin/quran/AyahList";
import { getGeminiConfigStatus } from "@/lib/admin/data/secrets";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { getSiteSession } from "@/lib/auth/session";
import { editableLanguagesFor, hasPermission } from "@/lib/permissions/check";

export const dynamic = "force-dynamic";

export default async function AdminSurahPage({
  params,
}: {
  params: Promise<{ surah: string }>;
}) {
  const { surah: surahParam } = await params;
  const num = Number(surahParam);
  if (!Number.isInteger(num) || num < 1 || num > 114) notFound();

  const [{ surah, ayahs }, geminiStatus, languageSettings, session] = await Promise.all([
    fetchSurahWithAyahs(num),
    getGeminiConfigStatus(),
    getLanguageSettings(),
    getSiteSession(),
  ]);
  if (!surah) notFound();
  const t = await getTranslations("quranAdmin.surah");

  const availableLangs = languageSettings.quranEnabled.filter((l) => l !== "ar");
  const permissions = session?.permissions ?? [];
  const editableLanguages = editableLanguagesFor(
    permissions,
    session?.languages,
    "quran.translate",
    availableLangs,
  );
  const canPublish = hasPermission(permissions, "quran.publish");

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <Link
            href="/admin/quran"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t("allSurahs")}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t("heading", { number: surah.number, name: surah.name_en })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle", {
              translated: surah.name_translated,
              count: surah.ayah_count,
            })}{" "}
            · <span className="capitalize">{surah.revelation_place}</span>
          </p>
        </div>
        <p dir="rtl" lang="ar" className="font-arabic text-3xl">
          {surah.name_ar}
        </p>
      </div>

      {ayahs.length === 0 ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm">
          {t.rich("emptyAyahs", { code: (chunks) => <code>{chunks}</code> })}
        </div>
      ) : (
        <AyahList
          ayahs={ayahs}
          surah={num}
          availableLangs={availableLangs}
          editableLanguages={editableLanguages}
          canPublish={canPublish}
          aiConfigured={geminiStatus.configured}
        />
      )}
    </div>
  );
}
