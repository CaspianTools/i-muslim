"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { ADMIN_NAV, type NavItem, type NavGroup } from "@/lib/admin/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions/check";
import type { RolePermissions } from "@/lib/permissions/catalog";

const COLLAPSE_KEY = "admin:sidebar-collapsed";
const COLLAPSE_EVENT = "admin:sidebar-collapsed-change";

function subscribeCollapse(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(COLLAPSE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(COLLAPSE_EVENT, cb);
  };
}

function getCollapse(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function useCollapse(enabled: boolean): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribeCollapse,
    getCollapse,
    () => false,
  );
  const setValue = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(COLLAPSE_EVENT));
    } catch {
      // ignore
    }
  }, []);
  return [enabled ? value : false, setValue];
}

export type SidebarBadges = Partial<
  Record<NonNullable<NavItem["badgeKey"]>, number>
>;

interface SidebarProps {
  badges?: SidebarBadges;
  variant?: "desktop" | "drawer";
  onNavigate?: () => void;
  logoUrl?: string | null;
  permissions: RolePermissions;
}

function filterNav(groups: readonly NavGroup[], permissions: RolePermissions): NavGroup[] {
  // Coming-soon items render as disabled chrome; we keep them visible to
  // anyone who can see the admin shell so they're discoverable.
  function visible(item: NavItem): boolean {
    if (item.comingSoon) return true;
    if (!item.requiredPermission) return true;
    return hasPermission(permissions, item.requiredPermission);
  }

  const out: NavGroup[] = [];
  for (const group of groups) {
    const items = group.items
      .filter(visible)
      .map((item) =>
        item.children
          ? { ...item, children: item.children.filter(visible) }
          : item,
      );
    if (items.length > 0) out.push({ ...group, items });
  }
  return out;
}

export function Sidebar({ badges = {}, variant = "desktop", onNavigate, logoUrl, permissions }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useCollapse(variant === "desktop");
  const t = useTranslations("sidebar");
  const tBrand = useTranslations("brand");
  const tHeader = useTranslations("header");

  const showLabels = variant === "drawer" || !collapsed;

  const nav = useMemo(() => filterNav(ADMIN_NAV, permissions), [permissions]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
          variant === "desktop" && (collapsed ? "w-16" : "w-[260px]"),
          variant === "drawer" && "w-full",
          "transition-[width] duration-200",
        )}
        aria-label={tHeader("navigation")}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-3 shrink-0",
            showLabels ? "justify-between" : "justify-center",
          )}
        >
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-2 font-semibold"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-7 w-7 rounded-md object-contain"
              />
            ) : (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm">
                ۞
              </span>
            )}
            {showLabels && <span className="text-sm">{tBrand("admin")}</span>}
          </Link>
          {variant === "desktop" && showLabels && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("collapse")}
              onClick={() => setCollapsed(true)}
              className="h-8 w-8"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <nav className={cn("space-y-5 pt-3 pb-6", showLabels ? "px-3" : "px-2")}>
            {nav.map((group) => (
              <div key={group.id}>
                {showLabels && (
                  <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(`groups.${group.id}` as `groups.${typeof group.id}`)}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const badgeValue = item.badgeKey ? badges[item.badgeKey] : undefined;
                    const label = t(`items.${item.labelKey}` as `items.${typeof item.labelKey}`);

                    const row = item.comingSoon ? (
                      <div
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-md py-2 text-sm text-muted-foreground/60 cursor-not-allowed select-none",
                          showLabels ? "px-2" : "justify-center px-0",
                        )}
                        aria-disabled="true"
                      >
                        <item.icon className="size-4 shrink-0 text-muted-foreground/60" />
                        {showLabels && <span className="flex-1 truncate">{label}</span>}
                        {showLabels && (
                          <Badge
                            variant="neutral"
                            className="ml-auto text-[10px] uppercase tracking-wide opacity-70"
                          >
                            {t("soonBadge")}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-md py-2 text-sm transition-colors",
                          "hover:bg-muted/70",
                          showLabels ? "px-2" : "justify-center px-0",
                          active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:bg-sidebar-accent",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {active && (
                          <span className="absolute start-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" />
                        )}
                        <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        {showLabels && <span className="flex-1 truncate">{label}</span>}
                        {showLabels && badgeValue !== undefined && badgeValue > 0 && (
                          <Badge variant={active ? "accent" : "neutral"} className="ml-auto">
                            {badgeValue}
                          </Badge>
                        )}
                      </Link>
                    );

                    const childList =
                      !item.comingSoon && showLabels && item.children && item.children.length > 0 && active ? (
                        <ul className="mt-0.5 space-y-0.5 ps-7">
                          {item.children.map((child) => {
                            const childActive = isActive(child.href);
                            const childLabel = t(
                              `items.${child.labelKey}` as `items.${typeof child.labelKey}`,
                            );
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={onNavigate}
                                  className={cn(
                                    "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                                    "hover:bg-muted/70",
                                    childActive &&
                                      "bg-sidebar-accent text-sidebar-accent-foreground font-medium hover:bg-sidebar-accent",
                                  )}
                                  aria-current={childActive ? "page" : undefined}
                                >
                                  <child.icon
                                    className={cn(
                                      "size-3.5 shrink-0",
                                      childActive ? "text-primary" : "text-muted-foreground",
                                    )}
                                  />
                                  <span className="flex-1 truncate">{childLabel}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null;

                    if (showLabels) {
                      return (
                        <li key={item.href}>
                          {row}
                          {childList}
                        </li>
                      );
                    }
                    return (
                      <li key={item.href}>
                        <Tooltip>
                          <TooltipTrigger asChild>{row}</TooltipTrigger>
                          <TooltipContent side="right">{label}</TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {!showLabels && (
          <div className="border-t border-sidebar-border p-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="flex h-8 w-full items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                  aria-label={t("expand")}
                >
                  <ChevronLeft className="size-4 rotate-180 rtl:rotate-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("expand")}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
