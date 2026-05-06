import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";

// Inlined from lib/auth/session.ts — that module pulls in firebase-admin,
// which is Node-only and can't run in the Edge proxy runtime.
const SESSION_COOKIE = "__session";

const intl = createIntlMiddleware(routing);

const LOCALE_PREFIX_RE = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

function pickLocaleFromCookie(req: NextRequest): string {
  const fromCookie = req.cookies.get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
}

// On Firebase App Hosting (Cloud Run), the container listens on internal
// :8080 while the public proxy serves :443. `req.nextUrl` reflects the
// internal request, so any absolute redirect built from it leaks `:8080`
// into the Location header. Rewrite it back to the external host using the
// x-forwarded-* headers Cloud Run sets.
function fixForwardedLocation(
  res: NextResponse,
  req: NextRequest,
): NextResponse {
  const location = res.headers.get("location");
  if (!location) return res;

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (!forwardedHost) return res;
  const forwardedProto = req.headers.get("x-forwarded-proto");

  try {
    const url = new URL(location, req.nextUrl);
    url.host = forwardedHost;
    url.port = "";
    if (forwardedProto) url.protocol = `${forwardedProto}:`;
    res.headers.set("location", url.toString());
  } catch {
    // Pathological Location value — leave untouched.
  }
  return res;
}

export function proxy(req: NextRequest) {
  return fixForwardedLocation(proxyImpl(req), req);
}

function proxyImpl(req: NextRequest): NextResponse {
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
