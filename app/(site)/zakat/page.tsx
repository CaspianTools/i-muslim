import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ZakatCalculator } from "@/components/zakat/ZakatCalculator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("zakat");
  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default function ZakatPage() {
  return <ZakatCalculator />;
}
