import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";

// Starter mailto for the deletion request. The subject decodes to
// "Delete my account — " (em dash + trailing space) for the user to complete
// with the app name, e.g. "Delete my account — i-muslim Quran".
const DELETE_MAILTO =
  "mailto:caspiantools@googlegroups.com?subject=Delete%20my%20account%20%E2%80%94%20";

const H2 = "text-xl font-semibold tracking-tight text-foreground";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("legal.deleteAccount");
  return buildPageMetadata({
    locale,
    path: "/delete-account",
    title: t("title"),
    description: t("description"),
  });
}

export default async function DeleteAccountPage() {
  const t = await getTranslations("legal.deleteAccount");

  const email = (chunks: ReactNode) => (
    <a
      href={DELETE_MAILTO}
      className="underline underline-offset-2 hover:text-foreground"
    >
      {chunks}
    </a>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("updated")}</p>
      </header>

      <p className="mb-10 leading-relaxed text-foreground/90">{t("intro")}</p>

      <section className="scroll-mt-24 space-y-4 leading-relaxed text-foreground/90">
        <h2 className={H2}>{t("howHeading")}</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t.rich("step1", { email })}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>
        <p>{t("howNote")}</p>
      </section>

      <section className="mt-12 scroll-mt-24 space-y-4 border-t border-border pt-8 leading-relaxed text-foreground/90">
        <h2 className={H2}>{t("deletedHeading")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("deleted1")}</li>
          <li>{t("deleted2")}</li>
        </ul>
      </section>

      <section className="mt-12 scroll-mt-24 space-y-4 border-t border-border pt-8 leading-relaxed text-foreground/90">
        <h2 className={H2}>{t("keptHeading")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("kept1")}</li>
          <li>{t("kept2")}</li>
        </ul>
      </section>

      <section className="mt-10 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">{t("contactLine")}</p>
      </section>
    </div>
  );
}
