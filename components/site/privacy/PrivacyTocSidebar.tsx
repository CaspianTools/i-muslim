"use client";

import { type MouseEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { PRIVACY_TOC, PRIVACY_TOC_IDS } from "@/lib/privacy/toc";
import { cn } from "@/lib/utils";

// Offset (px) of the sticky site Nav — mirrors the `scroll-mt-24` (96px) used on
// the privacy headings so a heading counts as "reached" exactly when it clears
// the sticky chrome.
const NAV_OFFSET = 96;

/**
 * In-page table of contents for the privacy page. Renders the section tree from
 * the shared `PRIVACY_TOC` data, highlights the section currently in view via an
 * IntersectionObserver scroll-spy, and supports collapsible groups + smooth
 * (reduced-motion aware) click-to-scroll. Desktop-only; the page hides it below
 * `lg`.
 */
export function PrivacyTocSidebar() {
  const t = useTranslations("legal.privacy");
  const [activeId, setActiveId] = useState<string>(PRIVACY_TOC_IDS[0]);
  // Holds the ids of *collapsed* groups; empty (the default) means all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Mark a section active and auto-expand (only — never auto-collapse) the group
  // it belongs to, so scrolling/jumping into a collapsed group reveals the
  // highlight while leaving the user's other manual collapses untouched. Stable
  // identity (no deps) so the scroll-spy effect below runs once.
  const activate = useCallback((id: string) => {
    setActiveId(id);
    const parent = PRIVACY_TOC.find(
      (group) => group.id === id || group.items.some((item) => item.id === id),
    );
    if (!parent) return;
    setCollapsed((prev) => {
      if (!prev.has(parent.id)) return prev;
      const next = new Set(prev);
      next.delete(parent.id);
      return next;
    });
  }, []);

  // Scroll-spy: observe every group section + heading and resolve a single
  // active id (the topmost one in view, with a rect fallback for the very top /
  // very bottom where the observer band can be momentarily empty).
  useEffect(() => {
    const els = PRIVACY_TOC_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (els.length === 0) return;

    const visible = new Set<string>();

    const resolveActive = () => {
      let topmost: string | null = null;
      let topmostIndex = Number.POSITIVE_INFINITY;
      visible.forEach((id) => {
        const index = PRIVACY_TOC_IDS.indexOf(id);
        if (index < topmostIndex) {
          topmostIndex = index;
          topmost = id;
        }
      });
      if (topmost) {
        activate(topmost);
        return;
      }
      // Nothing in the active band: fall back to the last heading whose top has
      // scrolled above the Nav line (in document order).
      let fallback = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= NAV_OFFSET) fallback = el.id;
        else break;
      }
      activate(fallback);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        resolveActive();
      },
      { rootMargin: `-${NAV_OFFSET}px 0px -55% 0px`, threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [activate]);

  const toggleGroup = (groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleJump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    activate(id);
  };

  return (
    <nav
      aria-label={t("tocLabel")}
      className="w-64 shrink-0 self-start rounded-lg border border-border bg-card p-2"
    >
      <p className="px-3 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("tocLabel")}
      </p>

      <div className="flex flex-col gap-1">
        {PRIVACY_TOC.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = !collapsed.has(group.id);
          const groupActive = activeId === group.id;
          const listId = `privacy-toc-${group.id}`;

          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={listId}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors hover:bg-muted/70",
                  groupActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent",
                )}
              >
                {groupActive && (
                  <span
                    aria-hidden
                    className="absolute start-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
                  />
                )}
                <GroupIcon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    groupActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="flex-1 truncate">{t(group.labelKey)}</span>
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen ? "rotate-90" : "rtl:rotate-180",
                  )}
                />
              </button>

              {isOpen && (
                <div className="relative mt-0.5">
                  {/* Vertical tree line — shares its inline-start offset with the
                      connector dots below so they align by construction (RTL-safe
                      via the logical `start` inset). */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute start-[0.6875rem] top-0 bottom-2 w-px bg-border/70"
                  />
                  <ul id={listId} className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const active = activeId === item.id;
                      return (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            onClick={(event) => handleJump(event, item.id)}
                            aria-current={active ? "location" : undefined}
                            className={cn(
                              "relative flex items-center gap-2 rounded-md py-1.5 pe-2 ps-6 text-sm transition-colors hover:bg-muted/70",
                              active
                                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent"
                                : "text-muted-foreground",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "absolute start-[0.6875rem] top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card rtl:translate-x-1/2",
                                active ? "bg-primary" : "bg-border",
                              )}
                            />
                            <ItemIcon
                              aria-hidden
                              className={cn(
                                "size-4 shrink-0",
                                active ? "text-primary" : "text-muted-foreground/80",
                              )}
                            />
                            <span className="truncate">{t(item.labelKey)}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
