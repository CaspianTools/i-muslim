"use client";

import { useEffect } from "react";

/**
 * Fires a single view beacon per browser session for the masjid page. Reads the
 * `?s=qr` marker (set by the QR code / poster) to distinguish scans from regular
 * visits. Renders nothing.
 */
export function MasjidViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `masjid-viewed-${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage unavailable (private mode) — still record the view
    }
    const scan = new URLSearchParams(window.location.search).get("s") === "qr";
    fetch(`/api/mosques/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scan }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
