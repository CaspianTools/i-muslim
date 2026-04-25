import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/site/contact/ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.contact");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function ContactPage() {
  const t = await getTranslations("legal.contact");
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </header>

      <p className="mb-6 leading-relaxed text-foreground/90">{t("intro")}</p>

      <ContactForm />

      <p className="mt-8 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {t("directoryNote")}
      </p>
    </div>
  );
}
