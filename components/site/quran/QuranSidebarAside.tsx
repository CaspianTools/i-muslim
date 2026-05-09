"use client";

import { useSyncExternalStore } from "react";
import type { LangCode } from "@/lib/translations";
import { QuranSidebar } from "./QuranSidebar";

const COLLAPSE_KEY = "quran:sidebar-collapsed";
const COLLAPSE_EVENT = "quran:sidebar-collapsed-change";

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

/**
 * The desktop sidebar wrapper. Reads the same `quran:sidebar-collapsed` flag
 * as `QuranSidebar` and `QuranFiltersButton` so the surrounding `<aside>`
 * (which would otherwise still consume the flex gap slot) disappears in lock
 * step when the user toggles the filter button.
 *
 * Rendered as `hidden md:block` so it's mobile-invisible regardless of
 * collapse state — mobile uses the Sheet drawer instead.
 */
export function QuranSidebarAside({
  availableLangs,
}: {
  availableLangs: readonly LangCode[];
}) {
  const collapsed = useSyncExternalStore(subscribeCollapse, getCollapse, () => false);
  if (collapsed) return null;
  return (
    <aside className="hidden md:block sticky top-20 self-start">
      <QuranSidebar variant="desktop" availableLangs={availableLangs} />
    </aside>
  );
}
