"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Offset (px) of the sticky site Nav — mirrors the `scroll-mt-24` (96px) used on
// the page headings so a heading counts as "reached" exactly when it clears the
// sticky chrome.
const NAV_OFFSET = 96;

export interface TocItem {
  /** DOM id of the target heading on the page. */
  id: string;
  label: string;
}

export interface TocGroup {
  /** DOM id of the target section, or any unique id for a category with no
   *  matching element (it simply never becomes "active"). */
  id: string;
  label: string;
  /** Sub-sections. Omit (or leave empty) for a flat, top-level navigable row. */
  items?: TocItem[];
}

/**
 * Reusable in-page table of contents. Renders a section tree from already
 * resolved `{ id, label }` data (so it works for both translated and
 * hardcoded pages), highlights the section in view via a dependency-free
 * IntersectionObserver scroll-spy, and supports collapsible groups + smooth
 * (reduced-motion aware) click-to-scroll. Desktop-only; the host page hides it
 * below `lg`.
 *
 * A group with `items` renders as a collapsible header (toggle) over an
 * indented, tree-connected list. A group without `items` renders as a single
 * navigable row — use those for a flat page like Terms.
 */
export function TocSidebar({
  label,
  groups,
  className,
}: {
  label: string;
  groups: TocGroup[];
  className?: string;
}) {
  // Flat, document-ordered id list used by the scroll-spy.
  const ids = useMemo(
    () => groups.flatMap((group) => [group.id, ...(group.items?.map((item) => item.id) ?? [])]),
    [groups],
  );

  const [activeId, setActiveId] = useState<string>(ids[0]);
  // Holds the ids of *collapsed* groups; empty (the default) means all expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Mark a section active and auto-expand (only — never auto-collapse) the group
  // it belongs to, so scrolling/jumping into a collapsed group reveals the
  // highlight while leaving the user's other manual collapses untouched.
  const activate = useCallback(
    (id: string) => {
      setActiveId(id);
      const parent = groups.find((group) => group.items?.some((item) => item.id === id));
      if (!parent) return;
      setCollapsed((prev) => {
        if (!prev.has(parent.id)) return prev;
        const next = new Set(prev);
        next.delete(parent.id);
        return next;
      });
    },
    [groups],
  );

  // Scroll-spy: resolve a single active id (the topmost one in view, with a rect
  // fallback for the very top / very bottom where the observer band can be empty).
  useEffect(() => {
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const visible = new Set<string>();

    const resolveActive = () => {
      let topmost: string | null = null;
      let topmostIndex = Number.POSITIVE_INFINITY;
      visible.forEach((id) => {
        const index = ids.indexOf(id);
        if (index < topmostIndex) {
          topmostIndex = index;
          topmost = id;
        }
      });
      if (topmost) {
        activate(topmost);
        return;
      }
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
  }, [ids, activate]);

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
      aria-label={label}
      className={cn(
        "w-64 shrink-0 self-start rounded-lg border border-border bg-card p-2",
        className,
      )}
    >
      <p className="px-3 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <div className="flex flex-col gap-1">
        {groups.map((group) => {
          const hasItems = !!group.items && group.items.length > 0;
          const isOpen = !collapsed.has(group.id);
          const groupActive = activeId === group.id;
          const listId = `toc-${group.id}`;

          return (
            <div key={group.id}>
              {hasItems ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  className={cn(
                    "relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium transition-colors hover:bg-muted/70",
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
                  <span className="flex-1 truncate">{group.label}</span>
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen ? "rotate-90" : "rtl:rotate-180",
                    )}
                  />
                </button>
              ) : (
                <a
                  href={`#${group.id}`}
                  onClick={(event) => handleJump(event, group.id)}
                  aria-current={groupActive ? "location" : undefined}
                  className={cn(
                    "relative flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/70",
                    groupActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground hover:bg-sidebar-accent"
                      : "text-foreground/80",
                  )}
                >
                  {groupActive && (
                    <span
                      aria-hidden
                      className="absolute start-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
                    />
                  )}
                  <span className="flex-1 truncate">{group.label}</span>
                </a>
              )}

              {hasItems && isOpen && (
                <div className="relative mt-0.5">
                  {/* Vertical tree line — shares its inline-start offset with the
                      connector dots below so they align by construction (RTL-safe
                      via the logical `start` inset). */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute start-[0.6875rem] top-0 bottom-2 w-px bg-border/70"
                  />
                  <ul id={listId} className="flex flex-col gap-0.5">
                    {group.items!.map((item) => {
                      const active = activeId === item.id;
                      return (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            onClick={(event) => handleJump(event, item.id)}
                            aria-current={active ? "location" : undefined}
                            className={cn(
                              "relative flex items-center rounded-md py-1.5 pe-2 ps-6 text-sm transition-colors hover:bg-muted/70",
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
                            <span className="flex-1 truncate">{item.label}</span>
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
