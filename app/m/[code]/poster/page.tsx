import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { fetchMosqueByShortCode } from "@/lib/admin/data/mosques";
import { getSiteUrl } from "@/lib/mosques/constants";
import { canManageMosque } from "@/lib/mosques/authz";
import { countryName } from "@/lib/mosques/countries";
import { pickLocalized } from "@/lib/utils";
import { isLocale, RTL_LOCALES, type Locale } from "@/i18n/config";
import { PosterToolbar } from "@/components/mosque/community/PosterToolbar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/**
 * Printable A4 QR poster for a masjid's noticeboard. The manager picks the
 * language (`?lang=`) their community reads, then prints or "Saves as PDF" from
 * the browser. Rendered as HTML (not pdf-lib) so any script — Arabic, Turkish,
 * RTL — renders natively, which the old WinAnsi PDF could not. The QR reuses the
 * existing `/m/<code>/qr` route, so scans from a printed poster count as scans.
 */
export default async function MasjidPosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ code }, { lang }] = await Promise.all([params, searchParams]);
  const { mosque } = await fetchMosqueByShortCode(code);
  if (!mosque) notFound();
  // Drafts are previewable only by their manager; published codes are public.
  if (mosque.status !== "published" && !(await canManageMosque(mosque.slug))) notFound();

  const requestLocale = (await getLocale()) as Locale;
  const locale: Locale = isLocale(lang) ? lang : requestLocale;
  const t = await getTranslations({ locale, namespace: "mosques.poster" });
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";

  const name = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;
  const initial = (name.trim()[0] ?? "M").toUpperCase();
  const showArabicName = Boolean(mosque.name.ar) && locale !== "ar";
  const cleanUrl = `${getSiteUrl()}/m/${code}`.replace(/^https?:\/\//, "");

  return (
    <main className="mq-poster-screen">
      <PosterToolbar current={locale} languageLabel={t("language")} printLabel={t("print")} />

      <article dir={dir} lang={locale} className="mq-poster">
        <div className="mq-poster-inner">
          <div className="mq-poster-logo">
            {mosque.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mosque.logoUrl} alt="" />
            ) : (
              <span>{initial}</span>
            )}
          </div>

          <h1 className="mq-poster-name">{name}</h1>
          {showArabicName && (
            <p dir="rtl" lang="ar" className="mq-poster-name-ar font-arabic">
              {mosque.name.ar}
            </p>
          )}
          <p className="mq-poster-city">
            {mosque.city}, {countryName(mosque.country, locale)}
          </p>

          <p className="mq-poster-heading">{t("scanHeading")}</p>

          <div className="mq-poster-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/m/${code}/qr?format=svg`} alt="" />
          </div>

          <p className="mq-poster-url">{cleanUrl}</p>
          <p className="mq-poster-tagline">{t("tagline")}</p>
          <p className="mq-poster-powered">{t("poweredBy")}</p>
        </div>
      </article>
    </main>
  );
}
