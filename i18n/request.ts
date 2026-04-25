import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  // 1) Prefer the locale captured by the [locale] segment (next-intl middleware
  //    has already validated and rewritten the request).
  let locale = (await requestLocale) as Locale | undefined;

  // 2) Fall back to cookie for routes outside the [locale] segment (admin, login).
  if (!locale || !isLocale(locale)) {
    const cookieStore = await cookies();
    const raw = cookieStore.get(LOCALE_COOKIE)?.value;
    locale = isLocale(raw) ? raw : routing.defaultLocale ?? DEFAULT_LOCALE;
  }

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
