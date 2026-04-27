import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { getLanguageSettings } from "@/lib/admin/data/language-settings";

export async function Footer() {
  const [t, locale, languageSettings] = await Promise.all([
    getTranslations("footer"),
    getLocale(),
    getLanguageSettings(),
  ]);
  const year = new Date().getFullYear();

  const linkClass =
    "text-muted-foreground transition-colors hover:text-foreground";
  const headingClass =
    "text-xs font-semibold uppercase tracking-wider text-foreground";

  return (
    <footer className="mt-16 border-t border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground text-sm">
              ۞
            </span>
            <span>i-muslim</span>
          </Link>
          <p className="text-muted-foreground">{t("tagline")}</p>
        </div>

        <nav aria-label={t("colWorship")} className="space-y-3">
          <h2 className={headingClass}>{t("colWorship")}</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/prayer-times" className={linkClass}>
                {t("prayerTimes")}
              </Link>
            </li>
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
            <li>
              <Link href="/zakat" className={linkClass}>
                {t("zakat")}
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
              <>
                <li>
                  <Link href="/articles" className={linkClass}>
                    {t("articles")}
                  </Link>
                </li>
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
              </>
            )}
          </ul>
        </nav>

        <nav aria-label={t("colCompany")} className="space-y-3">
          <h2 className={headingClass}>{t("colCompany")}</h2>
          <ul className="space-y-2">
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
          </ul>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <LocaleSwitcher availableLocales={languageSettings.uiEnabled} />
          </div>
          <p>
            {t.rich("attribution", {
              quran: (chunks) => (
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://quran.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {chunks}
                </a>
              ),
              hadith: (chunks) => (
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://github.com/fawazahmed0/hadith-api"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}

