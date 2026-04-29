import languages from "@cospired/i18n-iso-languages";
import enLocale from "@cospired/i18n-iso-languages/langs/en.json";
import arLocale from "@cospired/i18n-iso-languages/langs/ar.json";
import idLocale from "@cospired/i18n-iso-languages/langs/id.json";
import ruLocale from "@cospired/i18n-iso-languages/langs/ru.json";
import frLocale from "@cospired/i18n-iso-languages/langs/fr.json";
import msLocale from "@cospired/i18n-iso-languages/langs/ms.json";
import deLocale from "@cospired/i18n-iso-languages/langs/de.json";
import esLocale from "@cospired/i18n-iso-languages/langs/es.json";

languages.registerLocale(enLocale);
languages.registerLocale(arLocale);
languages.registerLocale(idLocale);
languages.registerLocale(ruLocale);
languages.registerLocale(frLocale);
languages.registerLocale(msLocale);
languages.registerLocale(deLocale);
languages.registerLocale(esLocale);

// Locales the @cospired/i18n-iso-languages package ships translations for. Other
// UI locales (tr, az, ur, fa, bn, hi) fall back to English language names.
const SUPPORTED_LOCALES = new Set(["en", "ar", "id", "ru", "fr", "ms", "de", "es"]);

export interface Language {
  code: string;
  name: string;
}

function resolveLocale(locale: string): string {
  const short = locale.split(/[-_]/)[0]?.toLowerCase() ?? "en";
  return SUPPORTED_LOCALES.has(short) ? short : "en";
}

export function getLanguages(locale: string = "en"): Language[] {
  const lang = resolveLocale(locale);
  const map = languages.getNames(lang);
  const collator = new Intl.Collator(lang, { sensitivity: "base" });
  return Object.entries(map)
    .map(([code, name]) => ({ code, name }))
    .filter((l) => l.name)
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function getLanguageName(code: string, locale: string = "en"): string {
  if (!code) return "";
  const lang = resolveLocale(locale);
  return languages.getName(code.toLowerCase(), lang) ?? code.toUpperCase();
}

export function isValidLanguageCode(code: string): boolean {
  return /^[a-z]{2}$/i.test(code) && languages.isValid(code.toLowerCase());
}
