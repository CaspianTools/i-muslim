import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ar" }, { locale: "tr" }, { locale: "id" }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Enable static rendering of segments under [locale]/.
  setRequestLocale(locale);

  return <>{children}</>;
}
