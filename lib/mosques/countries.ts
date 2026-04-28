import { getCountryName } from "@/lib/countries";

export function countryName(code: string, locale: string = "en"): string {
  if (!code) return "";
  return getCountryName(code, locale);
}

export function countrySlugFromCode(code: string): string {
  return code.toLowerCase();
}

export function countryCodeFromSlug(slug: string): string {
  return slug.toUpperCase();
}
