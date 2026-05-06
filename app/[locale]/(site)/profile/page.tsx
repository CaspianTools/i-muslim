import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/site/SignOutButton";
import { ProfileForm } from "@/components/site/profile/ProfileForm";
import { getSiteSession } from "@/lib/auth/session";
import { getProfileFields } from "@/lib/profile/data";
import { hasPermission } from "@/lib/permissions/check";
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
  if (!session) redirect("/login?callbackUrl=/profile");
  const isAdmin = hasPermission(session.permissions, "dashboard.read");
  const initial = await getProfileFields(session.uid);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </header>

      <section className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        <Avatar className="size-16">
          {session.picture && <AvatarImage src={session.picture} alt="" />}
          <AvatarFallback>{initials(session.name ?? session.email)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {initial?.displayName ?? session.name ?? session.email}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{session.email}</p>
          {isAdmin && (
            <span className="mt-1 inline-block rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
              {t("adminBadge")}
            </span>
          )}
        </div>
      </section>

      <ProfileForm initial={initial} />

      <section className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <span className="text-sm text-muted-foreground">{session.email}</span>
        <SignOutButton />
      </section>
    </div>
  );
}
