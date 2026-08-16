// Which tafsir language the reader sees, and whether they see it at all.
//
// This is a DIFFERENT axis from the `?lang=` Quran-translation filter. That one
// is parsed by `parseLangsParam` against `ALL_LANGS` (ar/en/ru/az/tr), which has
// no `id` — and adding `id` there would advertise an Indonesian Quran
// translation that does not exist. Commentary editions and verse translations
// are genuinely different sets, so they get their own parameter.
//
// Pure: no `server-only`, so the sidebar control can import the parser.

import { isTafsirLang, type TafsirLang } from "./works";

export const TAFSIR_PARAM = "tafsir";

/** `"off"` suppresses every tafsir affordance and skips all tafsir work. */
export type TafsirPreference = TafsirLang | "off";

/**
 * Default for a reader who has not chosen. Indonesian readers get the
 * Indonesian translation; everyone else gets the Arabic original, which is the
 * only other language published. Non-Arabic, non-Indonesian readers therefore
 * see Arabic — the UI labels that honestly rather than implying otherwise.
 */
export function defaultTafsirPreference(locale: string): TafsirPreference {
  return locale === "id" ? "id" : "ar";
}

export function parseTafsirParam(
  raw: string | undefined | null,
  locale: string,
): TafsirPreference {
  if (!raw) return defaultTafsirPreference(locale);
  const value = raw.trim().toLowerCase();
  if (value === "off") return "off";
  if (isTafsirLang(value)) return value;
  return defaultTafsirPreference(locale);
}

/**
 * Build the reader's query string, preserving both axes. Used by the surah
 * page so pagination and language switches don't silently drop the other
 * setting. Only non-default values are emitted, keeping canonical URLs clean.
 */
export function buildReaderQuery(
  langParam: string | undefined,
  tafsir: TafsirPreference,
  locale: string,
): string {
  const parts: string[] = [];
  if (langParam) parts.push(`lang=${encodeURIComponent(langParam)}`);
  if (tafsir !== defaultTafsirPreference(locale)) parts.push(`${TAFSIR_PARAM}=${tafsir}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
