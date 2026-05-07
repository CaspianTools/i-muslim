import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Heart,
  MapPin,
  Newspaper,
  ScrollText,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { HomeSection } from "./HomeSection";

export async function HomeFeatures() {
  const t = await getTranslations("home.features");
  const items: Array<{
    href: string;
    icon: ReactNode;
    title: string;
    description: string;
  }> = [
    {
      href: "/quran",
      icon: <BookOpen className="size-5" />,
      title: t("quran.title"),
      description: t("quran.description"),
    },
    {
      href: "/hadith",
      icon: <ScrollText className="size-5" />,
      title: t("hadith.title"),
      description: t("hadith.description"),
    },
    {
      href: "/mosques",
      icon: <MapPin className="size-5" />,
      title: t("mosques.title"),
      description: t("mosques.description"),
    },
    {
      href: "/matrimonial",
      icon: <Heart className="size-5" />,
      title: t("matrimonial.title"),
      description: t("matrimonial.description"),
    },
    {
      href: "/events",
      icon: <CalendarDays className="size-5" />,
      title: t("events.title"),
      description: t("events.description"),
    },
    {
      href: "/articles",
      icon: <Newspaper className="size-5" />,
      title: t("articles.title"),
      description: t("articles.description"),
    },
  ];
  // The six explore tiles duplicate destinations already reachable from the
  // bottom tab bar (Quran/Hadith/Mosques) and the /more page (Matrimonial/
  // Events/Articles), so they're hidden at <md. They still serve discovery
  // value at md+ where the tab bar isn't visible and the section reads as a
  // landing-page feature grid rather than redundant chrome.
  return (
    <div className="hidden md:block">
    <HomeSection heading={t("heading")} subheading={t("subheading")}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-6 transition-colors hover:border-accent"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-selected text-selected-foreground">
                  {item.icon}
                </span>
                <h3 className="text-base font-semibold">{item.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-accent">
                {t("openCta")}
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
    </div>
  );
}
