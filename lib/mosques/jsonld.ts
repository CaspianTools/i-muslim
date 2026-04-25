import type { Mosque } from "@/types/mosque";
import { getSiteUrl } from "./constants";

export function mosqueJsonLd(mosque: Mosque) {
  const site = getSiteUrl();
  const url = `${site}/mosques/${mosque.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Mosque",
    name: mosque.name.en,
    alternateName: [mosque.name.ar, mosque.name.tr, mosque.name.id].filter(Boolean),
    url,
    image: mosque.coverImage?.url,
    address: {
      "@type": "PostalAddress",
      streetAddress: [mosque.address.line1, mosque.address.line2].filter(Boolean).join(", "),
      addressLocality: mosque.city,
      addressRegion: mosque.region,
      postalCode: mosque.address.postalCode,
      addressCountry: mosque.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: mosque.location.lat,
      longitude: mosque.location.lng,
    },
    telephone: mosque.contact?.phone,
    sameAs: [
      mosque.contact?.website,
      mosque.social?.facebook,
      mosque.social?.instagram,
      mosque.social?.youtube,
    ].filter(Boolean),
    inLanguage: mosque.languages,
  };
}

export function mosqueListJsonLd(mosques: Mosque[], pageUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: pageUrl,
    numberOfItems: mosques.length,
    itemListElement: mosques.slice(0, 50).map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${getSiteUrl()}/mosques/${m.slug}`,
      name: m.name.en,
    })),
  };
}
