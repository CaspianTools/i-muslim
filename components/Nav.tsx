import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { SearchButton } from "./SearchButton";
import { SiteUserMenu } from "./site/SiteUserMenu";
import { getSiteSession } from "@/lib/auth/session";
import { isAdminEmail } from "@/lib/auth/allowlist";

export async function Nav() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  const session = await getSiteSession();
  const isAdmin = isAdminEmail(session?.email);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground text-sm">
            ۞
          </span>
          <span className="hidden sm:inline">i-muslim</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
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
