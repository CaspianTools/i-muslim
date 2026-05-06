"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { SETTINGS_NAV } from "@/lib/admin/settings/nav";
import { cn } from "@/lib/utils";

export function SettingsSidebar() {
  const pathname = usePathname();
  const t = useTranslations("adminSettings.nav");

  const isActive = (href: string) => {
    if (href === "/admin/settings") return pathname === "/admin/settings";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label={t("ariaLabel")}
      className={cn(
        // Mobile: horizontal scroll-tabs strip above content.
        "-mx-1 flex gap-1 overflow-x-auto pb-2",
        // Desktop: vertical list, fixed width.
        "md:mx-0 md:w-56 md:shrink-0 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0",
        // Desktop: card chrome around the stacked nav buttons.
        "md:self-start md:rounded-lg md:border md:border-border md:bg-card md:p-2",
      )}
    >
      {SETTINGS_NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
              "hover:bg-muted/70",
              active &&
                "bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:bg-sidebar-accent",
            )}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <span className="absolute start-0 top-1 bottom-1 hidden w-0.5 rounded-full bg-primary md:block" />
            )}
            <item.icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span className="flex-1 truncate">{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
