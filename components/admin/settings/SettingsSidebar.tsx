"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SETTINGS_NAV, type SettingsNavItem } from "@/lib/admin/settings/nav";
import { cn } from "@/lib/utils";

export function SettingsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("adminSettings.nav");

  // For the General root (`/admin/settings`), we want exact-only matching so
  // it doesn't claim to be active on every settings sub-page.
  const matchesPath = (href: string) => {
    if (href === "/admin/settings") return pathname === "/admin/settings";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // A child item is active when its pathname matches AND its scope query
  // matches the current scope. The Interface child has no scope query, so
  // it's active only when no scope param is present.
  const isChildActive = (child: SettingsNavItem) => {
    if (pathname !== child.href) return false;
    const childScope = child.query?.scope ?? null;
    const currentScope = searchParams.get("scope");
    return childScope === currentScope;
  };

  const isParentActive = (item: SettingsNavItem) => {
    if (item.children?.some(isChildActive)) return false;
    return matchesPath(item.href);
  };

  return (
    <nav
      aria-label={t("ariaLabel")}
      className={cn(
        "flex w-72 max-w-[300px] shrink-0 flex-col gap-0.5 self-start rounded-lg border border-border bg-card p-2",
      )}
    >
      {SETTINGS_NAV.map((item) => (
        <div key={item.id} className="flex flex-col gap-0.5">
          <NavRow
            item={item}
            active={isParentActive(item)}
            label={t(item.labelKey)}
          />
          {item.children && item.children.length > 0 && (
            <div className="ms-5 flex flex-col gap-0.5 border-s border-border/60 ps-2">
              {item.children.map((child) => (
                <NavRow
                  key={child.id}
                  item={child}
                  active={isChildActive(child)}
                  label={t(child.labelKey)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

function NavRow({
  item,
  active,
  label,
}: {
  item: SettingsNavItem;
  active: boolean;
  label: string;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.query ? { pathname: item.href, query: item.query } : item.href}
      className={cn(
        "group relative flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors",
        "hover:bg-muted/70",
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:bg-sidebar-accent",
      )}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span className="absolute start-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" />
      )}
      {Icon && (
        <Icon
          className={cn(
            "size-4 shrink-0",
            active ? "text-primary" : "text-muted-foreground",
          )}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}
