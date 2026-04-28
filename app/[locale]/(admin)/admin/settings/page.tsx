import { getTranslations } from "next-intl/server";
import { LanguagesForm } from "@/components/admin/settings/LanguagesForm";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { listReservedLocaleDocs } from "@/lib/admin/data/ui-locales";
import {
  computeTranslationStats,
  type MessageTree,
} from "@/lib/i18n/translation-stats";
import { BUNDLED_LOCALES, type BundledLocale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import trMessages from "@/messages/tr.json";
import idMessages from "@/messages/id.json";

const BUNDLED_MESSAGES: Record<BundledLocale, MessageTree> = {
  en: enMessages as MessageTree,
  ar: arMessages as MessageTree,
  tr: trMessages as MessageTree,
  id: idMessages as MessageTree,
};

function isBundledLocale(code: string): code is BundledLocale {
  return (BUNDLED_LOCALES as readonly string[]).includes(code);
}

export default async function Page() {
  const [settings, reservedDocs, t] = await Promise.all([
    getLanguageSettings(),
    listReservedLocaleDocs(),
    getTranslations("adminSettings.languages"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <LanguagesForm
        initial={{
          uiEnabled: settings.uiEnabled,
          quranEnabled: settings.quranEnabled,
          hadithEnabled: settings.hadithEnabled,
          reservedLocales: reservedDocs.map((d) => {
            const baseCode: BundledLocale = isBundledLocale(d.baseLocale)
              ? d.baseLocale
              : "en";
            const stats = d.activated
              ? computeTranslationStats(
                  BUNDLED_MESSAGES[baseCode],
                  (d.messages ?? {}) as MessageTree,
                )
              : { total: 0, translated: 0, percent: 0 };
            return {
              code: d.code,
              activated: d.activated,
              nativeName: d.nativeName,
              englishName: d.englishName,
              flag: d.flag,
              rtl: d.rtl,
              baseLocale: d.baseLocale,
              messages: d.messages,
              stats,
            };
          }),
        }}
      />
    </div>
  );
}
