import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CalendarDays, Heart, Mail, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignInButton } from "@/components/site/SignInButton";
import { SignOutButton } from "@/components/site/SignOutButton";
import { getSiteSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/allowlist";
import { initials } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const session = await getSiteSession();

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("signInPrompt")}</p>
        </header>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="mb-6 text-foreground/90">{t("signInBody")}</p>
          <SignInButton />
        </div>
      </div>
    );
  }

  const isAdmin = isAdminEmail(session.email);
  const links = [
    {
      href: "/matrimonial/settings" as const,
      icon: Heart,
      title: t("links.matrimonial"),
      description: t("links.matrimonialDescription"),
    },
    {
      href: "/events" as const,
      icon: CalendarDays,
      title: t("links.events"),
      description: t("links.eventsDescription"),
    },
    {
      href: "/mosques/submit" as const,
      icon: MapPin,
      title: t("links.submitMosque"),
      description: t("links.submitMosqueDescription"),
    },
    {
      href: "/contact" as const,
      icon: Mail,
      title: t("links.contact"),
      description: t("links.contactDescription"),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </header>

      <section className="mb-8 flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        <Avatar className="size-16">
          {session.picture && <AvatarImage src={session.picture} alt="" />}
          <AvatarFallback>{initials(session.name ?? session.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {session.name ?? session.email}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{session.email}</p>
          {isAdmin && (
            <span className="mt-1 inline-block rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
              {t("adminBadge")}
            </span>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("yourSpace")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/50 hover:bg-muted/50"
              >
                <Icon className="size-5 shrink-0 text-muted-foreground group-hover:text-accent" />
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground">{l.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{l.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {isAdmin && (
        <section className="mb-8 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            {t("adminSection.title")}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("adminSection.description")}
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("adminSection.cta")}
          </Link>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("session")}
        </h2>
        <SignOutButton />
      </section>
    </div>
  );
}
