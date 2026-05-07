"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { PROFILE_NAV } from "@/lib/profile/nav";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll-strip of the profile nav. Used at <md instead of the
 * sidebar-drawer pattern, because the drawer trigger (a hamburger) is
 * invisible-UI on mobile — users can't see what section they're in or
 * what's available without tapping. The strip is auto-discoverable.
 *
 * `overflow-x-auto` is OK here because the strip is ~120 px tall and
 * obviously horizontal — it doesn't span the page width like the
 * navbar's old overflow row did.
 */
export function ProfileMobileTabs() {
  const pathname = usePathname();
  const t = useTranslations("profileNav");

  const isActive = (href: string) => {
    if (href === "/profile") return pathname === "/profile";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      aria-label={t("title")}
      className="-mx-4 overflow-x-auto px-4 pb-2 md:hidden"
    >
      <ul className="flex w-max gap-1">
        {PROFILE_NAV.map((item) => {
          const active = isActive(item.href);
          const label = t(`items.${item.labelKey}` as `items.${typeof item.labelKey}`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "ui-selected-chip"
                    : "ui-selected-chip-idle",
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
