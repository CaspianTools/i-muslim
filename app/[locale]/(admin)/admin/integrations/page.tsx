import { getTranslations } from "next-intl/server";
import { AiTranslationSettings } from "@/components/admin/settings/AiTranslationSettings";
import { getGeminiConfigStatus } from "@/lib/admin/data/secrets";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [geminiStatus, t] = await Promise.all([
    getGeminiConfigStatus(),
    getTranslations("sidebar.items"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("integrations")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          External services wired into the admin tools.
        </p>
      </div>
      <AiTranslationSettings initial={geminiStatus} />
    </div>
  );
}
