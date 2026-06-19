import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Picks the value for `locale` from a localized text record, falling back to
// English. Used to render admin-authored content (business names, mosque
// descriptions, etc.) under any UI locale — including reserved ones for which
// no per-locale value exists.
export function pickLocalized<M extends object, K extends Extract<keyof M, string>>(
  map: M,
  locale: string,
  fallback: K,
): M[K] | undefined {
  const dynKey = locale as K;
  return (map as Record<K, M[K] | undefined>)[dynKey] ?? (map as Record<K, M[K] | undefined>)[fallback];
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Locale-aware relative time ("5m ago" / "5 dk. önce" / "قبل 5 دقائق"). Uses the
// runtime's Intl.RelativeTimeFormat (CLDR data ships with V8) so every UI locale
// — bundled and reserved — localizes without any authored message keys. `style`
// is "narrow" to keep the terse glyphs the UI was designed around; the sub-minute
// bucket uses numeric:"auto" so it reads "now"/"şimdi" rather than "0 seconds ago".
// `locale` is required: callers pass the active UI locale (useLocale() in client
// components, getLocale() in server components / pages).
export function formatRelative(
  date: Date | string | number,
  locale: string,
): string {
  const d = typeof date === "object" ? date : new Date(date);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  const rtf = (numeric: "always" | "auto") =>
    new Intl.RelativeTimeFormat(locale, { numeric, style: "narrow" });

  if (sec < 45) return rtf("auto").format(0, "second");
  if (min < 60) return rtf("always").format(-min, "minute");
  if (hr < 24) return rtf("always").format(-hr, "hour");
  if (day < 30) return rtf("always").format(-day, "day");
  const months = Math.round(day / 30);
  if (months < 12) return rtf("always").format(-months, "month");
  return rtf("always").format(-Math.round(months / 12), "year");
}
