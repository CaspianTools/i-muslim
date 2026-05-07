"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

const TRIGGER_DISTANCE = 70;
const MAX_VISIBLE = 100;
const ENGAGE_AT = 50;

/**
 * Native-style pull-to-refresh on touch devices. Wrap a list page with this
 * component (children render unchanged; the indicator is portaled-over). Pulls
 * are recognised only when the document is at scroll-top — otherwise normal
 * native scroll bounce applies. On release past the trigger distance, calls
 * `router.refresh()` which re-runs the server component tree, returning fresh
 * data from any cached fetches that have since been invalidated.
 *
 * Touch-only — no mouse handling. Desktop relies on browser refresh / a real
 * refresh button. Mobile users expect this gesture from every native list app.
 *
 * Implementation notes:
 *  - Listens at the document level via passive `touchstart`/`touchmove` so we
 *    don't block scroll on devices where we're not pulling.
 *  - Resists overscroll geometrically (sqrt curve) so the indicator slows as
 *    the user pulls past `MAX_VISIBLE`, hinting the refresh is engaged.
 *  - `router.refresh()` is fire-and-forget; the indicator hides immediately.
 *    For data that takes longer to refresh, the loading.tsx boundary covers
 *    the in-flight render.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const trackingRef = useRef(false);
  // Mirror of `pull` updated inside the touchmove handler so the touchend
  // closure sees the freshest distance without us re-binding listeners on
  // every render. Mutated only inside event handlers — never during render —
  // so the React Compiler's "modifying a value used in an effect" rule is
  // satisfied.
  const pullRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof navigator === "undefined" || !("ontouchstart" in window)) {
      return;
    }

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;
      const t = e.touches[0];
      if (!t) return;
      startYRef.current = t.clientY;
      trackingRef.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!trackingRef.current || startYRef.current === null) return;
      const t = e.touches[0];
      if (!t) return;
      const delta = t.clientY - startYRef.current;
      if (delta <= 0) {
        setPull(0);
        pullRef.current = 0;
        return;
      }
      // Sqrt resistance curve for overscroll feel.
      const dampened = Math.min(MAX_VISIBLE, Math.sqrt(delta) * 7);
      setPull(dampened);
      pullRef.current = dampened;
    }

    function onTouchEnd() {
      if (!trackingRef.current) return;
      const reached = pullRef.current >= ENGAGE_AT;
      trackingRef.current = false;
      startYRef.current = null;
      setPull(0);
      pullRef.current = 0;
      if (reached) {
        setRefreshing(true);
        router.refresh();
        // Hide indicator after a beat — refresh() returns instantly but the
        // RSC fetch may take a tick. The loading boundary covers the rest.
        window.setTimeout(() => setRefreshing(false), 400);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  const visible = pull > 0 || refreshing;
  const opacity = Math.min(1, pull / TRIGGER_DISTANCE);
  const angle = (pull / TRIGGER_DISTANCE) * 270;

  return (
    <>
      <div
        aria-hidden={!visible}
        className="fixed inset-x-0 top-0 z-30 flex justify-center pointer-events-none"
        style={{
          transform: `translateY(${refreshing ? 24 : pull * 0.6}px)`,
          opacity: refreshing ? 1 : opacity,
          // No state-derived flag for this — when pull is non-zero we're
          // mid-gesture and want instant tracking; when it's 0 we want a
          // smooth release animation.
          transition:
            pull > 0 ? "none" : "transform 0.2s ease-out, opacity 0.2s ease-out",
        }}
      >
        <div className="mt-2 inline-flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-md">
          <RefreshCw
            className={`size-4 ${refreshing ? "animate-spin text-primary" : "text-muted-foreground"}`}
            style={{
              transform: refreshing ? undefined : `rotate(${angle}deg)`,
              transition: "transform 0.05s linear",
            }}
          />
        </div>
      </div>
      {children}
    </>
  );
}
