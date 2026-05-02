import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </header>
      <div className="space-y-4 leading-relaxed text-foreground/90">
        <p>{t("p1")}</p>

        <h2 className="pt-4 text-lg font-semibold text-foreground">{t("h1")}</h2>
        <p>{t("p2")}</p>

        <h2 className="pt-4 text-lg font-semibold text-foreground">{t("h2")}</h2>
        <p>{t("p3")}</p>

        <h2 className="pt-4 text-lg font-semibold text-foreground">{t("h3")}</h2>
        <p>{t("p4")}</p>

        <h2 className="pt-4 text-lg font-semibold text-foreground">{t("h4")}</h2>
        <p>{t("p5")}</p>

        <h2 className="pt-4 text-lg font-semibold text-foreground">{t("h5")}</h2>
        <p>{t("p6")}</p>
      </div>
    </div>
  );
}
