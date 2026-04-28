import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.about");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("legal.about");
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
        <p>{t("p2")}</p>
        <p>{t("p3")}</p>
      </div>
      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {t("creditsTitle")}
        </h2>
        <p className="mt-3 text-foreground/90">
          {t.rich("credits", {
            quran: (chunks) => (
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://quran.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                {chunks}
              </a>
            ),
            hadith: (chunks) => (
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://github.com/fawazahmed0/hadith-api"
                target="_blank"
                rel="noopener noreferrer"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>
    </div>
  );
}
