import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { SearchButton } from "./SearchButton";
import { SiteUserMenu } from "./site/SiteUserMenu";
import { getSiteSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/check";
import { getSiteConfig } from "@/lib/admin/data/site-config";

export async function Nav() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const session = await getSiteSession();
  const siteConfig = await getSiteConfig();
  const isAdmin = session ? hasPermission(session.permissions, "dashboard.read") : false;
  return (
    <header
      data-reading-chrome
      className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          {siteConfig.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={siteConfig.logoUrl}
              alt=""
              className="h-7 w-7 rounded-md object-contain"
            />
          ) : (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground text-sm">
              ۞
            </span>
          )}
          <span>{siteConfig.siteName}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link
            href="/quran"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t("quran")}
          </Link>
          <Link
            href="/hadith"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t("hadith")}
          </Link>
          <Link
            href="/mosques"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t("mosques")}
          </Link>
          <Link
            href="/matrimonial"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t("matrimonial")}
          </Link>
          <Link
            href="/events"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t("events")}
          </Link>
          {locale === "en" && (
            <Link
              href="/articles"
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t("articles")}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <SearchButton />
          <ThemeToggle />
          <SiteUserMenu session={session} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
