"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, MoreHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MosqueManagePanel } from "@/components/mosque/MosqueManagePanel";
import { useInstallPrompt } from "@/components/pwa/InstallPromptProvider";
import type { Mosque } from "@/types/mosque";

export type CoverView = "posts" | "about" | "events" | "duas";

export interface CoverNavItem {
  key: CoverView;
  label: string;
  href: string;
}

/**
 * The masjid cover's sub-navigation. Desktop (≥sm) keeps the horizontal tab
 * strip with a manage kebab; phones collapse it to the active view's name + a
 * hamburger that opens a bottom drawer holding every view (and Manage, for a
 * manager). One controlled MosqueManagePanel serves both the desktop kebab and
 * the drawer's Manage entry.
 */
export function MosqueNav({
  activeView,
  items,
  mosque,
  analytics,
  canManage,
}: {
  activeView: CoverView;
  items: CoverNavItem[];
  mosque: Mosque;
  analytics?: { views: number; scans: number };
  canManage: boolean;
}) {
  const t = useTranslations("mosques.community");
  const tManage = useTranslations("mosques.manage");
  const tInstall = useTranslations("mosques.install");
  const { canInstall, install } = useInstallPrompt();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const active = items.find((i) => i.key === activeView) ?? items[0];

  return (
    <>
      {/* Desktop: horizontal tab strip + manage kebab. */}
      <nav className="mt-4 hidden items-center border-t border-border sm:flex">
        <div className="flex flex-1 gap-1 overflow-x-auto overflow-y-hidden">
          {items.map((i) => (
            <Link key={i.key} href={i.href} className={`mq-tab${i.key === activeView ? " active" : ""}`}>
              {i.label}
            </Link>
          ))}
        </div>
        {canManage && (
          <div className="shrink-0 ps-1 pe-0">
            <button
              type="button"
              aria-label={tManage("manage")}
              onClick={() => setManageOpen(true)}
              className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="size-5" />
            </button>
          </div>
        )}
      </nav>

      {/* Mobile: active view label + hamburger → bottom drawer. */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2 sm:hidden">
        <span className="font-display text-base text-foreground">{active?.label}</span>
        <button
          type="button"
          aria-label={t("menu")}
          onClick={() => setDrawerOpen(true)}
          className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>{t("menu")}</SheetTitle>
          </SheetHeader>
          <nav className="p-2">
            {items.map((i) => (
              <Link
                key={i.key}
                href={i.href}
                onClick={() => setDrawerOpen(false)}
                className={`block rounded-lg px-3 py-3 text-base ${
                  i.key === activeView
                    ? "bg-selected font-semibold text-accent"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {i.label}
              </Link>
            ))}
            {canInstall && (
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  void install();
                }}
                className="block w-full rounded-lg px-3 py-3 text-start text-base text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {tInstall("install")}
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  // defer so the drawer's focus restore doesn't fight the dialog
                  setTimeout(() => setManageOpen(true), 0);
                }}
                className="block w-full rounded-lg px-3 py-3 text-start text-base text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {tManage("manage")}
              </button>
            )}
          </nav>
        </SheetContent>
      </Sheet>

      {canManage && (
        <MosqueManagePanel
          mosque={mosque}
          analytics={analytics}
          open={manageOpen}
          onOpenChange={setManageOpen}
        />
      )}
    </>
  );
}
