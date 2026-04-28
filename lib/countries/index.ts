import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import arLocale from "i18n-iso-countries/langs/ar.json";
import trLocale from "i18n-iso-countries/langs/tr.json";
import idLocale from "i18n-iso-countries/langs/id.json";

countries.registerLocale(enLocale);
countries.registerLocale(arLocale);
countries.registerLocale(trLocale);
countries.registerLocale(idLocale);

const SUPPORTED_LOCALES = new Set(["en", "ar", "tr", "id"]);

export interface Country {
  code: string;
  name: string;
}

function resolveLocale(locale: string): string {
  const short = locale.split(/[-_]/)[0]?.toLowerCase() ?? "en";
  return SUPPORTED_LOCALES.has(short) ? short : "en";
}

function pickName(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

export function getCountries(locale: string = "en"): Country[] {
  const lang = resolveLocale(locale);
  const map = countries.getNames(lang, { select: "official" });
  const collator = new Intl.Collator(lang, { sensitivity: "base" });
  return Object.entries(map)
    .map(([code, name]) => ({ code, name: pickName(name) }))
    .filter((c) => c.name)
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function getCountryName(code: string, locale: string = "en"): string {
  if (!code) return "";
  const lang = resolveLocale(locale);
  return countries.getName(code.toUpperCase(), lang) ?? code.toUpperCase();
}

export function isValidCountryCode(code: string): boolean {
  return /^[A-Za-z]{2}$/.test(code) && countries.isValid(code.toUpperCase());
}

export function getAlpha2FromName(name: string, locale: string = "en"): string | undefined {
  if (!name) return undefined;
  const lang = resolveLocale(locale);
  return countries.getAlpha2Code(name, lang);
}
