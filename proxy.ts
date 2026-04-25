import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { routing } from "@/i18n/routing";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";

const intl = createIntlMiddleware(routing);

const LOCALE_PREFIX_RE = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

function pickLocaleFromCookie(req: NextRequest): string {
  const fromCookie = req.cookies.get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  // Strip the leading locale (if any) to make routing decisions on the
  // canonical, locale-less path. Examples:
  //   /en/admin/users  → /admin/users
  //   /admin/users     → /admin/users
  //   /ru              → /
  const match = pathname.match(LOCALE_PREFIX_RE);
  const stripped = match ? pathname.slice(match[0].length) || "/" : pathname;
  const urlLocale = match ? (match[1] as string) : null;
  const locale = urlLocale ?? pickLocaleFromCookie(req);

  // Skip i18n + auth entirely for these.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Admin auth gate — applies whether or not the URL is locale-prefixed.
  if (stripped.startsWith("/admin")) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.searchParams.set(
        "callbackUrl",
        urlLocale ? pathname : `/${locale}${pathname}`,
      );
      return NextResponse.redirect(url);
    }
    // Has session — let intl middleware ensure the URL has a locale prefix
    // and rewrite for the [locale] segment.
    return intl(req);
  }

  // Logged-in users hitting /login bounce to /admin (locale-aware).
  if (stripped === "/login" || stripped === "/login/") {
    if (hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}/admin`;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return intl(req);
  }

  // Everything else (public site) → next-intl handles locale routing.
  return intl(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
