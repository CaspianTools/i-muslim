import { defineRouting } from "next-intl/routing";
import { LOCALES, DEFAULT_LOCALE } from "./config";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Always show the locale prefix in the URL (e.g. /en/quran/1, /ru/quran/1).
  // Users explicitly want this — see project memory.
  localePrefix: "always",
  // Persist user's chosen locale in a cookie so the middleware can pick the
  // right default on first visit.
  localeCookie: {
    name: "i-muslim-lang",
    maxAge: 60 * 60 * 24 * 365,
  },
});
