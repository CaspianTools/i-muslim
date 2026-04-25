import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SubmitMosqueForm } from "@/components/mosque/SubmitMosqueForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosques.submit");
  return { title: t("title"), description: t("subtitle") };
}

export default async function SubmitMosquePage() {
  const t = await getTranslations("mosques.submit");
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("guideline")}
        </p>
      </header>
      <div className="mt-6">
        <SubmitMosqueForm />
      </div>
    </div>
  );
}
