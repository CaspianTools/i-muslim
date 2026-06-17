import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HijriDateConverter } from "@/components/hijri-converter/HijriDateConverter";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("hijriConverter");
  return buildPageMetadata({
    locale,
    path: "/hijri-converter",
    title: t("title"),
    description: t("subtitle"),
  });
}

export default function HijriConverterPage() {
  return <HijriDateConverter />;
}
