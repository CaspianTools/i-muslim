import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TocSidebar } from "@/components/site/TocSidebar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return {
    title: t("title"),
    description: t("description"),
  };
}

const H2 = "text-xl font-semibold tracking-tight text-foreground";
const H3 = "scroll-mt-24 pt-4 text-lg font-semibold text-foreground";

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");
  const tc = await getTranslations("common");

  // Table-of-contents tree — ids match the section/heading ids rendered below.
  const tocGroups = [
    {
      id: "website",
      label: t("webHeading"),
      items: [
        { id: "website-location", label: t("h1") },
        { id: "website-account", label: t("h2") },
        { id: "website-tracking", label: t("h3") },
        { id: "website-contact", label: t("h4") },
      ],
    },
    {
      id: "android-app",
      label: t("app.heading"),
      items: [
        { id: "app-collect", label: t("app.collectHeading") },
        { id: "app-store", label: t("app.storeHeading") },
        { id: "app-permissions", label: t("app.permissionsHeading") },
        { id: "app-children", label: t("app.childrenHeading") },
        { id: "app-changes", label: t("app.changesHeading") },
        { id: "app-contact", label: t("app.contactHeading") },
      ],
    },
  ];

  // Shared rich-text renderer: turns the <contact>…</contact> tag in a message
  // into a locale-aware link to the contact page.
  const contactLink = {
    contact: (chunks: ReactNode) => (
      <Link
        href="/contact"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {chunks}
      </Link>
    ),
  };

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

          <p className="mb-10 leading-relaxed text-foreground/90">{t("lead")}</p>

          {/* Website (i-muslim.com) */}
          <section
            id="website"
            className="scroll-mt-24 space-y-4 leading-relaxed text-foreground/90"
          >
            <h2 className={H2}>{t("webHeading")}</h2>
            <p>{t("p1")}</p>

            <h3 id="website-location" className={H3}>
              {t("h1")}
            </h3>
            <p>{t("p2")}</p>

            <h3 id="website-account" className={H3}>
              {t("h2")}
            </h3>
            <p>{t("p3")}</p>

            <h3 id="website-tracking" className={H3}>
              {t("h3")}
            </h3>
            <p>{t("p4")}</p>

            <h3 id="website-contact" className={H3}>
              {t("h4")}
            </h3>
            <p>{t.rich("p5", contactLink)}</p>
          </section>

          {/* i-muslim Quran (Android app) */}
          <section
            id="android-app"
            className="mt-12 scroll-mt-24 space-y-4 border-t border-border pt-8 leading-relaxed text-foreground/90"
          >
            <h2 className={H2}>{t("app.heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("app.updated")}</p>
            <p>{t("app.intro")}</p>

            <h3 id="app-collect" className={H3}>
              {t("app.collectHeading")}
            </h3>
            <p>{t("app.collectIntro")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("app.collect1")}</li>
              <li>{t("app.collect2")}</li>
              <li>{t("app.collect3")}</li>
            </ul>

            <h3 id="app-store" className={H3}>
              {t("app.storeHeading")}
            </h3>
            <p>{t("app.storeIntro")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("app.store1")}</li>
              <li>{t("app.store2")}</li>
              <li>{t("app.store3")}</li>
            </ul>
            <p>{t("app.storeNote")}</p>

            <h3 id="app-permissions" className={H3}>
              {t("app.permissionsHeading")}
            </h3>
            <p>{t("app.permissions")}</p>

            <h3 id="app-children" className={H3}>
              {t("app.childrenHeading")}
            </h3>
            <p>{t("app.children")}</p>

            <h3 id="app-changes" className={H3}>
              {t("app.changesHeading")}
            </h3>
            <p>{t("app.changes")}</p>

            <h3 id="app-contact" className={H3}>
              {t("app.contactHeading")}
            </h3>
            <p>{t.rich("app.contact", contactLink)}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
