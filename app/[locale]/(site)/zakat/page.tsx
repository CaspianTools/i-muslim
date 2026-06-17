import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { ZakatCalculator } from "@/components/zakat/ZakatCalculator";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("zakat");
  return buildPageMetadata({
    locale,
    path: "/zakat",
    title: t("title"),
    description: t("subtitle"),
  });
}

export default function ZakatPage() {
  return <ZakatCalculator />;
}
