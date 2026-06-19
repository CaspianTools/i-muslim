import languages from "@cospired/i18n-iso-languages";
import enLocale from "@cospired/i18n-iso-languages/langs/en.json";

languages.registerLocale(enLocale);

export interface Language {
  code: string;
  name: string;
}

// Language *names* come from the runtime's Intl.DisplayNames, which localizes for
// EVERY UI locale via CLDR (tr → "İngilizce", "Rusça"; az/ur/fa/bn/hi included) —
// the @cospired/i18n-iso-languages package only shipped a handful of locales and
// silently fell back to English for the rest. The package is kept solely for the
// canonical ISO-639-1 code set and isValidLanguageCode; its registered locale
// (en) is used only to enumerate codes, not to render names.
const CODE_LIST: string[] = Object.keys(languages.getNames("en"));

function displayNames(locale: string): Intl.DisplayNames {
  return new Intl.DisplayNames([locale], { type: "language" });
}

export function getLanguages(locale: string = "en"): Language[] {
  const dn = displayNames(locale);
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  return CODE_LIST.map((code) => ({ code, name: dn.of(code) ?? code.toUpperCase() }))
    .filter((l) => l.name)
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function getLanguageName(code: string, locale: string = "en"): string {
  if (!code) return "";
  return displayNames(locale).of(code.toLowerCase()) ?? code.toUpperCase();
}

export function isValidLanguageCode(code: string): boolean {
  return /^[a-z]{2}$/i.test(code) && languages.isValid(code.toLowerCase());
}
