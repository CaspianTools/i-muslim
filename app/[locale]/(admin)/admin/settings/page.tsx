import { getTranslations } from "next-intl/server";
import { LanguagesForm } from "@/components/admin/settings/LanguagesForm";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";

export default async function Page() {
  const [settings, t] = await Promise.all([
    getLanguageSettings(),
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
          contentEnabled: settings.contentEnabled,
        }}
      />
    </div>
  );
}
