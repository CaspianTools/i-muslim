"use client";

import { useEffect } from "react";

/**
 * Registers the hand-written `/sw.js` once per page-load. Skipped in dev
 * because Turbopack-served bundles change on every keystroke and a stale SW
 * cache would mask hot-reload behaviour.
 *
 * Mounts under the root layout so a single registration covers every route
 * (including the locale-prefixed public routes and admin). The actual SW
 * fetch handler is conservative — it only intercepts `/_next/static/*`,
 * `/icons/*`, and `*.svg` (see `public/sw.js`).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal — the app works without a SW.
      // Swallow rather than surfacing a console error users can't act on.
    });
  }, []);

  return null;
}
