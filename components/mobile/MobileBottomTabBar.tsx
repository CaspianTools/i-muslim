"use client";

import { BookOpen, Quote, Clock, MapPin, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const TABS: Array<{
  href: string;
  match: (p: string) => boolean;
  Icon: typeof BookOpen;
  labelKey: string;
}> = [
  {
    href: "/quran",
    match: (p) => p.startsWith("/quran"),
    Icon: BookOpen,
    labelKey: "quran",
  },
  {
    href: "/hadith",
    match: (p) => p.startsWith("/hadith"),
    Icon: Quote,
    labelKey: "hadith",
  },
  {
    href: "/prayer-times",
    match: (p) => p.startsWith("/prayer-times"),
    Icon: Clock,
    labelKey: "prayer",
  },
  {
    href: "/mosques",
    match: (p) => p.startsWith("/mosques"),
    Icon: MapPin,
    labelKey: "mosques",
  },
  {
    href: "/more",
    match: (p) => p.startsWith("/more"),
    Icon: Menu,
    labelKey: "more",
  },
];

export function MobileBottomTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="mobile-tabbar md:hidden" aria-label={t("primary")}>
      {TABS.map(({ href, match, Icon, labelKey }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className="mobile-tabbar-link"
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
