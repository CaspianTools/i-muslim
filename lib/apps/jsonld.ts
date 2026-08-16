import { SITE_URL } from "@/lib/seo/metadata";
import type { AppRelease } from "@/lib/apps/types";

/**
 * The schema.org MobileApplication block for an /apps/* page.
 *
 * The shape is the shared asset here; every value differs per app. Note that
 * `applicationCategory` and `inLanguage` are required rather than defaulted —
 * they are exactly the two fields an app would otherwise inherit wrongly and
 * silently (a prayer app is not a ReferenceApplication, and the two apps do not
 * necessarily ship the same UI languages).
 */
export function mobileAppJsonLd(app: {
  name: string;
  description: string;
  locale: string;
  /** Site-relative page path, e.g. "/apps/quran". */
  path: string;
  /** e.g. "ReferenceApplication", "LifestyleApplication". */
  applicationCategory: string;
  latest: AppRelease;
  /** Canonical listing URL, without the `hl` the on-page button adds. */
  playUrl: string;
  /** Site-relative icon path, e.g. "/apps/quran/icon-512.png". */
  iconPath: string;
  /** Site-relative screenshot paths. */
  screenshots: string[];
  /** The app's own UI languages, which are not necessarily the site's four. */
  inLanguage: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    name: app.name,
    description: app.description,
    url: `${SITE_URL}/${app.locale}${app.path}`,
    applicationCategory: app.applicationCategory,
    operatingSystem: "Android",
    softwareVersion: app.latest.version,
    dateModified: app.latest.date,
    releaseNotes: app.latest.note,
    installUrl: app.playUrl,
    downloadUrl: app.playUrl,
    image: `${SITE_URL}${app.iconPath}`,
    screenshot: app.screenshots.map((s) => `${SITE_URL}${s}`),
    inLanguage: app.inLanguage,
    isFamilyFriendly: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    author: {
      "@type": "Organization",
      name: "Caspian Tools",
      url: "https://caspiantools.com",
    },
    publisher: { "@type": "Organization", name: "i-muslim", url: SITE_URL },
  };
}
