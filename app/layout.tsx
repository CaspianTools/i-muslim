import type { Metadata, Viewport } from "next";
import {
  Inter,
  IBM_Plex_Sans,
  Roboto,
  Amiri,
  Scheherazade_New,
  Noto_Naskh_Arabic,
  IBM_Plex_Sans_Arabic,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { ThemeProvider } from "@/components/ThemeProvider";
import { dirFor, type Locale } from "@/i18n/config";
import {
  getSiteConfig,
  type BodyFont,
  type ArabicFont,
} from "@/lib/admin/data/site-config";
import "./globals.css";

// Body / UI font candidates. The Typography settings page swaps which one
// `--font-sans` resolves to via inline CSS variables on <html>. All variants
// are pre-loaded so changes take effect without a redeploy; the cost is one
// extra woff2 per non-default variant.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// Arabic display font candidates. `--font-arabic` is what `.font-arabic`
// resolves to (Quran/Hadith body text). Default Amiri matches the original.
const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

const scheherazade = Scheherazade_New({
  variable: "--font-scheherazade",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoNaskh = Noto_Naskh_Arabic({
  variable: "--font-noto-naskh",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const BODY_FONT_VAR: Record<BodyFont, string> = {
  inter: "--font-inter",
  "plex-sans": "--font-plex-sans",
  roboto: "--font-roboto",
};

const ARABIC_FONT_VAR: Record<ArabicFont, string> = {
  amiri: "--font-amiri",
  scheherazade: "--font-scheherazade",
  "noto-naskh": "--font-noto-naskh",
};

const FALLBACK_TAGLINE =
  "A clean, fast reader for the Quran and major Hadith collections with Arabic, English, Russian, and Azerbaijani translations.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewportFit:'cover' is required so env(safe-area-inset-*) returns non-zero
  // on notched iPhones; without it, the bottom tab bar sits on the home
  // indicator instead of above it.
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  const titleSuffix = config.siteName;
  const description = config.tagline || FALLBACK_TAGLINE;
  const meta: Metadata = {
    title: {
      default: `${config.siteName} — Read Quran and Sunnah`,
      template: `%s · ${titleSuffix}`,
    },
    description,
  };
  if (config.faviconUrl) {
    meta.icons = { icon: config.faviconUrl };
  }
  if (config.ogImageUrl) {
    meta.openGraph = {
      images: [{ url: config.ogImageUrl, width: 1200, height: 630 }],
    };
  }
  return meta;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, siteConfig] = await Promise.all([
    getLocale() as Promise<Locale>,
    getMessages(),
    getSiteConfig(),
  ]);
  const dir = dirFor(locale);

  // Resolve admin-chosen typography to concrete CSS variables. The fallback
  // chains mirror the defaults in globals.css so an unfamiliar font silently
  // degrades to system-ui / serif rather than the browser's last-resort font.
  const fontStyle = {
    "--font-sans": `var(${BODY_FONT_VAR[siteConfig.bodyFont]}), system-ui, -apple-system, sans-serif`,
    "--font-arabic": `var(${ARABIC_FONT_VAR[siteConfig.arabicFont]}), "Amiri", "Scheherazade New", serif`,
  } as React.CSSProperties;

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${inter.variable} ${plexSans.variable} ${roboto.variable} ${amiri.variable} ${scheherazade.variable} ${notoNaskh.variable} ${plexArabic.variable} antialiased`}
      style={fontStyle}
    >
      <body className="min-h-dvh flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
