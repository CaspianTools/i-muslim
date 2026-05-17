import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";
import { listActivatedReservedLocales } from "@/lib/admin/data/ui-locales";
import { getSiteConfig } from "@/lib/admin/data/site-config";
import { BUNDLED_LOCALES, type Locale } from "@/i18n/config";

export async function Footer() {
  const [t, locale, languageSettings, activated, siteConfig] = await Promise.all([
    getTranslations("footer"),
    getLocale(),
    getLanguageSettings(),
    listActivatedReservedLocales(),
    getSiteConfig(),
  ]);
  const year = new Date().getFullYear();

  // A locale appears in the public switcher iff it has translations available
  // (bundled or activated) AND admin enabled it in Settings.
  const usable = new Set<Locale>([...BUNDLED_LOCALES, ...activated]);
  const availableLocales = languageSettings.uiEnabled.filter((l) => usable.has(l));

  const linkClass =
    "text-muted-foreground transition-colors hover:text-foreground";
  const headingClass =
    "text-xs font-semibold uppercase tracking-wider text-foreground";

  return (
    <footer
      data-reading-chrome
      className="mt-16 hidden border-t border-border bg-muted/40 md:block"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
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
          <p className="text-muted-foreground">{siteConfig.tagline || t("tagline")}</p>
        </div>

        <nav aria-label={t("colWorship")} className="space-y-3">
          <h2 className={headingClass}>{t("colWorship")}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/quran" className={linkClass}>
                {t("quran")}
              </Link>
            </li>
            <li>
              <Link href="/hadith" className={linkClass}>
                {t("hadith")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("colCommunity")} className="space-y-3">
          <h2 className={headingClass}>{t("colCommunity")}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/mosques" className={linkClass}>
                {t("mosques")}
              </Link>
            </li>
            <li>
              <Link href="/events" className={linkClass}>
                {t("events")}
              </Link>
            </li>
            <li>
              <Link href="/matrimonial" className={linkClass}>
                {t("matrimonial")}
              </Link>
            </li>
            <li>
              <Link href="/businesses" className={linkClass}>
                {t("businesses")}
              </Link>
            </li>
            {locale === "en" && (
              <li>
                <Link href="/articles" className={linkClass}>
                  {t("articles")}
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <nav aria-label={t("colTools")} className="space-y-3">
          <h2 className={headingClass}>{t("colTools")}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/prayer-times" className={linkClass}>
                {t("prayerTimes")}
              </Link>
            </li>
            <li>
              <Link href="/zakat" className={linkClass}>
                {t("zakat")}
              </Link>
            </li>
            <li>
              <Link href="/hijri-converter" className={linkClass}>
                {t("hijriConverter")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year })}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <nav aria-label={t("colCompany")}>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                <li>
                  <Link href="/about" className={linkClass}>
                    {t("about")}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className={linkClass}>
                    {t("privacy")}
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className={linkClass}>
                    {t("terms")}
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className={linkClass}>
                    {t("contact")}
                  </Link>
                </li>
                <li>
                  <Link href="/developers" className={linkClass}>
                    {t("developers")}
                  </Link>
                </li>
                {locale === "en" && (
                  <li>
                    <a
                      className={linkClass}
                      href="/articles/rss.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("rss")}
                    </a>
                  </li>
                )}
              </ul>
            </nav>
            <LocaleSwitcher availableLocales={availableLocales} />
          </div>
        </div>
      </div>
    </footer>
  );
}

