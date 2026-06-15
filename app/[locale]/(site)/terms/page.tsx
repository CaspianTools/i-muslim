import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TocSidebar } from "@/components/site/TocSidebar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return {
    title: t("title"),
    description: t("description"),
  };
}

const H2 = "scroll-mt-24 pt-4 text-lg font-semibold text-foreground";

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");
  const tc = await getTranslations("common");

  // Flat table-of-contents — ids match the heading ids rendered below.
  const tocGroups = [
    { id: "terms-as-is", label: t("h1") },
    { id: "terms-sacred-content", label: t("h2") },
    { id: "terms-conduct", label: t("h3") },
    { id: "terms-changes", label: t("h4") },
    { id: "terms-zakat", label: t("h5") },
    { id: "terms-comments", label: t("h6") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="flex gap-8 lg:gap-10">
        <aside className="hidden lg:block sticky top-20 self-start">
          <TocSidebar label={tc("onThisPage")} groups={tocGroups} />
        </aside>

        <div className="min-w-0 max-w-3xl flex-1">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t("title")}
            </h1>
            <p className="mt-2 text-muted-foreground">{t("description")}</p>
          </header>
          <div className="space-y-4 leading-relaxed text-foreground/90">
            <p>{t("p1")}</p>

            <h2 id="terms-as-is" className={H2}>
              {t("h1")}
            </h2>
            <p>{t("p2")}</p>

            <h2 id="terms-sacred-content" className={H2}>
              {t("h2")}
            </h2>
            <p>{t("p3")}</p>

            <h2 id="terms-conduct" className={H2}>
              {t("h3")}
            </h2>
            <p>{t("p4")}</p>

            <h2 id="terms-changes" className={H2}>
              {t("h4")}
            </h2>
            <p>{t("p5")}</p>

            <h2 id="terms-zakat" className={H2}>
              {t("h5")}
            </h2>
            <p>{t("p6")}</p>

            <h2 id="terms-comments" className={H2}>
              {t("h6")}
            </h2>
            <p>{t("p7")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
