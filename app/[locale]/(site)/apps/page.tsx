import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { type Locale } from "@/i18n/config";

/**
 * There is one app page today, so an /apps index would be a single card and a
 * wasted hop. But /apps must not 404 — people trim URLs. Temporary redirect,
 * deliberately not permanent: when Prayer Times ships and this becomes a real
 * index, a cached 308 would be painful to undo.
 */
export default async function AppsIndexPage() {
  const locale = (await getLocale()) as Locale;
  redirect({ href: "/apps/quran", locale });
}
