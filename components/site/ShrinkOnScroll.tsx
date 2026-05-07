"use client";

import { useEffect } from "react";

/**
 * Toggles a `data-scrolled` attribute on `<html>` once the user has scrolled
 * past 80 px. Pair with CSS in globals.css to compress sticky chrome on
 * mobile — the prayer bar already scrolls away naturally because it isn't
 * sticky, but the Nav stays pinned via `sticky top-0` and benefits from a
 * smaller padding past the fold.
 *
 * No-op on desktop and on routes without a scroll container — the CSS rule
 * gates on `@media (max-width: 767px)` so this listener can run unconditionally
 * without paying any visual cost outside mobile.
 *
 * Implementation note: `requestAnimationFrame` throttles writes to the DOM
 * (mutating `data-scrolled` per scroll tick is a layout-thrashing footgun).
 * passive listener so we don't block the scroll thread.
 */
export function ShrinkOnScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let ticking = false;
    let scrolled = document.documentElement.dataset.scrolled === "true";
    const apply = () => {
      const next = window.scrollY > 80;
      if (next === scrolled) return;
      scrolled = next;
      document.documentElement.dataset.scrolled = String(next);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        apply();
        ticking = false;
      });
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      delete document.documentElement.dataset.scrolled;
    };
  }, []);

  return null;
}
