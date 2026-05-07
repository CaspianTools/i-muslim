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

// `req.nextUrl.host` in Next 16's middleware runtime drops the port (in dev,
// "localhost:7777" becomes "localhost"; in prod behind Cloud Run, the
// internal ":8080" leaks while the external host is :443). Either way an
// absolute redirect built from `req.nextUrl` ends up wrong. Rewrite the
// Location header using the most reliable host we have: x-forwarded-host
// when present (Cloud Run + most reverse proxies), else the browser's own
// Host header (dev + any unproxied environment).
function fixForwardedLocation(
  res: NextResponse,
  req: NextRequest,
): NextResponse {
  const location = res.headers.get("location");
  if (!location) return res;

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const targetHost = forwardedHost ?? req.headers.get("host");
  if (!targetHost) return res;

  try {
    const url = new URL(location, req.nextUrl);
    if (url.host === targetHost) return res; // already correct

    if (forwardedHost) {
      // Cloud Run path: external host with no port; clear any leaked
      // internal port (e.g. :8080) and respect the original protocol.
      url.host = forwardedHost;
      url.port = "";
      if (forwardedProto) url.protocol = `${forwardedProto}:`;
    } else {
      // Dev path: the Host header already encodes "localhost:7777" —
      // setting url.host with the colon-port form parses both pieces.
      url.host = targetHost;
    }
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
