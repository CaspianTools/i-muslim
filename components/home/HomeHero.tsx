import { getTranslations } from "next-intl/server";
import { ArrowRight, BookOpen, ScrollText } from "lucide-react";
import { Link } from "@/i18n/navigation";

export async function HomeHero() {
  const t = await getTranslations("home");
  return (
    // Compressed at <md: subhead + secondary CTA hide so the hero clears in
    // ~one viewport at 390 × 844, leaving Ayah-of-the-Day visible above the
    // fold instead of two scrolls down.
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-selected via-background to-background px-6 py-8 text-center md:px-10 md:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, var(--color-accent) 0, transparent 40%), radial-gradient(circle at 80% 80%, var(--color-primary) 0, transparent 45%)",
        }}
      />
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic text-3xl text-accent md:text-5xl"
      >
        {t("bismillah")}
      </p>
      <h1 className="mx-auto mt-4 md:mt-6 max-w-3xl text-2xl font-semibold tracking-tight md:text-5xl">
        {t("headline")}
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground hidden md:block md:text-lg">
        {t("tagline")}
      </p>
      <div className="mt-6 md:mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/quran"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <BookOpen className="size-4" />
          {t("hero.ctaQuran")}
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
        <Link
          href="/hadith"
          className="hidden md:inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
        >
          <ScrollText className="size-4" />
          {t("hero.ctaHadith")}
        </Link>
      </div>
    </section>
  );
}
