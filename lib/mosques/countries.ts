// Minimal ISO-3166 alpha-2 lookup. Add more on demand.
// Centralizes country labels so we don't depend on Intl.DisplayNames everywhere
// (it differs across runtimes and isn't always tree-shaken).

export const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AU: "Australia",
  AZ: "Azerbaijan",
  BA: "Bosnia and Herzegovina",
  CA: "Canada",
  DE: "Germany",
  EG: "Egypt",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  ID: "Indonesia",
  IN: "India",
  IR: "Iran",
  JO: "Jordan",
  KZ: "Kazakhstan",
  MA: "Morocco",
  MY: "Malaysia",
  NG: "Nigeria",
  NL: "Netherlands",
  OM: "Oman",
  PK: "Pakistan",
  PS: "Palestine",
  QA: "Qatar",
  RU: "Russia",
  SA: "Saudi Arabia",
  SG: "Singapore",
  TR: "Türkiye",
  US: "United States",
  UZ: "Uzbekistan",
  YE: "Yemen",
  ZA: "South Africa",
};

export function countryName(code: string, locale: string = "en"): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    const v = dn.of(code.toUpperCase());
    if (v) return v;
  } catch {
    // fall through
  }
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

export function countrySlugFromCode(code: string): string {
  return code.toLowerCase();
}

export function countryCodeFromSlug(slug: string): string {
  return slug.toUpperCase();
}
