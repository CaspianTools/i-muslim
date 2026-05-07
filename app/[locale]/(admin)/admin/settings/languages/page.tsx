import { getTranslations } from "next-intl/server";
import {
  LanguagesForm,
  type LanguagesScope,
} from "@/components/admin/settings/LanguagesForm";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { listAllUiLocaleDocs } from "@/lib/admin/data/ui-locales";
import { getContentTranslationStats } from "@/lib/admin/data/content-translation-stats";
import {
  computeTranslationStats,
  type MessageTree,
} from "@/lib/i18n/translation-stats";
import {
  BUNDLED_LOCALES,
  LOCALES,
  isBundled,
  type BundledLocale,
  type Locale,
} from "@/i18n/config";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import trMessages from "@/messages/tr.json";
import idMessages from "@/messages/id.json";
import { getSiteSession } from "@/lib/auth/session";
import { editableLanguagesFor } from "@/lib/permissions/check";

const BUNDLED_MESSAGES: Record<BundledLocale, MessageTree> = {
  en: enMessages as MessageTree,
  ar: arMessages as MessageTree,
  tr: trMessages as MessageTree,
  id: idMessages as MessageTree,
};

function isBundledLocale(code: string): code is BundledLocale {
  return (BUNDLED_LOCALES as readonly string[]).includes(code);
}

function resolveScope(raw: string | string[] | undefined): LanguagesScope {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "quran" || value === "hadith" ? value : "interface";
}

// Deep-merge `overlay` over `base`, mirroring the runtime merge in
// `i18n/request.ts`. Used to compute the "effective" message tree for
// bundled locales where the bundled JSON is the base translation and any
// admin-saved Firestore overlay sits on top.
function deepMerge(base: MessageTree, overlay: MessageTree): MessageTree {
  const out: MessageTree = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const isObj =
      value !== null && typeof value === "object" && !Array.isArray(value);
    const baseIsObj =
      base[key] !== null &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key]);
    if (isObj && baseIsObj) {
      out[key] = deepMerge(base[key] as MessageTree, value as MessageTree);
    } else if (value !== undefined) {
      out[key] = value as MessageTree[string];
    }
  }
  return out;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string | string[] }>;
}) {
  const [params, settings, localeDocs, contentStats, t, session] =
    await Promise.all([
      searchParams,
      getLanguageSettings(),
      listAllUiLocaleDocs(),
      getContentTranslationStats(),
      getTranslations("adminSettings.languages"),
      getSiteSession(),
    ]);
  const scope = resolveScope(params.scope);
  const tNav = await getTranslations("adminSettings.nav");
  const heading =
    scope === "quran"
      ? tNav("languagesQuran")
      : scope === "hadith"
        ? tNav("languagesHadith")
        : tNav("languagesInterface");

  const editableLanguages = session
    ? (editableLanguagesFor(
        session.permissions,
        session.languages,
        "uiLocales.translate",
        LOCALES,
      ) as Locale[])
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <LanguagesForm
        scope={scope}
        editableLanguages={editableLanguages}
        initial={{
          uiEnabled: settings.uiEnabled,
          quranEnabled: settings.quranEnabled,
          hadithEnabled: settings.hadithEnabled,
          quranStats: contentStats.quran,
          hadithStats: contentStats.hadith,
          reservedLocales: localeDocs.map((d) => {
            const baseCode: BundledLocale = isBundledLocale(d.baseLocale)
              ? d.baseLocale
              : "en";
            const baseTree = BUNDLED_MESSAGES[baseCode];
            const overlay = (d.messages ?? {}) as MessageTree;
            // Stats use the *effective* tree (bundled JSON merged with
            // overlay for bundled non-en locales) so the row's progress
            // chip reflects what end users actually see at runtime. The
            // overlay we hand to the editor stays raw — the dialog falls
            // back to the locale's bundled JSON for unset keys.
            const stats = isBundled(d.code)
              ? d.code === "en"
                ? { total: 0, translated: 0, percent: 100 }
                : computeTranslationStats(
                    BUNDLED_MESSAGES.en,
                    deepMerge(
                      BUNDLED_MESSAGES[d.code as BundledLocale],
                      overlay,
                    ),
                  )
              : d.activated
                ? computeTranslationStats(baseTree, overlay)
                : { total: 0, translated: 0, percent: 0 };
            return {
              code: d.code,
              activated: d.activated,
              nativeName: d.nativeName,
              englishName: d.englishName,
              flag: d.flag,
              rtl: d.rtl,
              baseLocale: d.baseLocale,
              messages: overlay,
              stats,
            };
          }),
        }}
      />
    </div>
  );
}
