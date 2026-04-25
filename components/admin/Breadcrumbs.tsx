"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { flattenNav, type NavItemKey } from "@/lib/admin/nav";

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations("breadcrumbs");
  const tNav = useTranslations("sidebar");
  const nav = flattenNav();

  if (pathname === "/admin") {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <span className="font-medium text-foreground">{t("dashboard")}</span>
      </div>
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const match = nav.find((n) => n.href === href);
    const label = match
      ? tNav(`items.${match.labelKey}` as `items.${NavItemKey}`)
      : seg.replace(/-/g, " ");
    return { href, label };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <Link href="/admin" className="text-muted-foreground hover:text-foreground">
        {t("dashboard")}
      </Link>
      {crumbs.slice(1).map((c, i) => {
        const isLast = i === crumbs.length - 2;
        return (
          <span key={c.href} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground rtl:rotate-180" aria-hidden />
            {isLast ? (
              <span className="font-medium text-foreground capitalize">{c.label}</span>
            ) : (
              <Link href={c.href} className="capitalize text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
