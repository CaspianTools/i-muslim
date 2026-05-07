import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  isBundled,
  type Locale,
} from "./config";
import { getUiLocaleDoc } from "@/lib/admin/data/ui-locales";

type Messages = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Deep-merge `overlay` over `base`. Used to apply a partial Firestore-uploaded
// translation set on top of English so missing keys fall back gracefully.
function deepMerge(base: Messages, overlay: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      out[key] = deepMerge(base[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

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

  // Bundled locales: load the static JSON shipped with the build, then
  // deep-merge any Firestore overlay an admin/translator has saved on top.
  // The overlay is optional — when no doc or no `messages` field exists, the
  // bundled JSON renders unchanged.
  if (isBundled(locale)) {
    const bundled = (await import(`../messages/${locale}.json`))
      .default as Messages;
    const overlayDoc = await getUiLocaleDoc(locale);
    const overlay = overlayDoc?.messages as Messages | undefined;
    if (!overlay || Object.keys(overlay).length === 0) {
      return { locale, messages: bundled };
    }
    return { locale, messages: deepMerge(bundled, overlay) };
  }

  // Reserved locales: read uploaded translations from Firestore and deep-merge
  // them on top of English so partial uploads (or no upload yet) still render.
  const englishBase = (await import(`../messages/en.json`)).default as Messages;
  const dynamic = await getUiLocaleDoc(locale);
  if (!dynamic || !dynamic.activated) {
    // Reserved but not activated yet → render English content under the
    // locale URL so the site doesn't crash. Users normally never reach this
    // path because the LocaleSwitcher hides un-activated reserved locales.
    return { locale, messages: englishBase };
  }
  const baseMessages =
    dynamic.baseLocale && dynamic.baseLocale !== "en" && isBundled(dynamic.baseLocale)
      ? ((await import(`../messages/${dynamic.baseLocale}.json`)).default as Messages)
      : englishBase;
  return {
    locale,
    messages: deepMerge(baseMessages, dynamic.messages as Messages),
  };
});
