import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Calculator,
  Calendar,
  Heart,
  Newspaper,
  Sparkles,
  Store,
  User as UserIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SiteUserMenu } from "@/components/site/SiteUserMenu";
import { getSiteSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/check";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { listActivatedReservedLocales } from "@/lib/admin/data/ui-locales";
import { BUNDLED_LOCALES, type Locale } from "@/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("more");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function MorePage() {
  const [t, tNav, locale, session, languageSettings, activated] =
    await Promise.all([
      getTranslations("more"),
      getTranslations("nav"),
      getLocale(),
      getSiteSession(),
      getLanguageSettings(),
      listActivatedReservedLocales(),
    ]);
  const isAdmin = session
    ? hasPermission(session.permissions, "dashboard.read")
    : false;

  // Mirror the public footer's locale-availability rule so the language
  // switcher here doesn't list locales the admin has disabled.
  const usable = new Set<Locale>([...BUNDLED_LOCALES, ...activated]);
  const availableLocales = languageSettings.uiEnabled.filter((l) =>
    usable.has(l),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <Section title={t("sectionCommunity")}>
        <Row href="/matrimonial" Icon={Heart} label={tNav("matrimonial")} />
        <Row href="/events" Icon={Calendar} label={tNav("events")} />
        <Row href="/businesses" Icon={Store} label={t("businesses")} />
        {locale === "en" && (
          <Row href="/articles" Icon={Newspaper} label={tNav("articles")} />
        )}
      </Section>

      <Section title={t("sectionTools")}>
        <Row href="/zakat" Icon={Calculator} label={t("zakat")} />
        <Row
          href="/hijri-converter"
          Icon={Sparkles}
          label={t("hijriConverter")}
        />
      </Section>

      <Section title={t("sectionAccount")}>
        {session ? (
          <Row href="/profile" Icon={UserIcon} label={t("profile")} />
        ) : null}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0">
          <span className="text-sm text-muted-foreground">{t("account")}</span>
          <SiteUserMenu session={session} isAdmin={isAdmin} />
        </div>
      </Section>

      <Section title={t("sectionPreferences")}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <span className="text-sm">{t("language")}</span>
          <LocaleSwitcher availableLocales={availableLocales} />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm">{t("theme")}</span>
          <ThemeToggle />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-lg border border-border bg-card overflow-hidden">
      <h2 className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/40">
        {title}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

function Row({
  href,
  Icon,
  label,
}: {
  href: string;
  Icon: typeof Calculator;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 text-sm text-foreground border-b border-border last:border-0 transition-colors hover:bg-muted"
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1">{label}</span>
      </Link>
    </li>
  );
}
