"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const VISIT_KEY = "i-muslim-visit-count";
const DISMISSED_KEY = "i-muslim-install-dismissed";
const MIN_VISITS = 3;

// Subscribe to localStorage changes (cross-tab and same-tab via the synthetic
// StorageEvent we dispatch on writes). Returns a cleanup function as
// `useSyncExternalStore` requires.
const subscribeStorage = (cb: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (!e.key || e.key === VISIT_KEY || e.key === DISMISSED_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
};

// Snapshot readers — guarded against SSR and localStorage failures (private
// mode / quota). All return primitive values so React's strict-equality
// comparison in `useSyncExternalStore` doesn't trigger spurious renders.
const readVisits = (): number => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(VISIT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const readDismissed = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return true;
  }
};

// `useSyncExternalStore` needs a stable subscribe ref even for one-shot
// reads (`isStandalone` / `isIOSSafari` never change after mount). A noop
// subscribe is fine because there's nothing to listen to.
const noopSubscribe = (): (() => void) => () => {};

// `BeforeInstallPromptEvent` is Chromium-specific and not in lib.dom.d.ts.
// We only touch the two methods we use; treat the rest as opaque.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // matchMedia is the spec; navigator.standalone is the iOS Safari quirk.
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (typeof navigator !== "undefined" &&
      "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad on iPadOS 13+ reports as Macintosh with touch — include that case.
  const isIDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIDevice && /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Install-prompt banner. Two code paths sharing one UI:
 *
 *  Android / Chromium desktop in a mobile viewport: listens for
 *  `beforeinstallprompt`, stores the event, calls `event.prompt()` when the
 *  user taps Install. Renders nothing until the event has fired (so the
 *  banner doesn't appear in browsers that won't actually install).
 *
 *  iOS Safari: detects via UA + `display-mode !== standalone` and renders
 *  the same banner; tapping Install expands an inline instruction line
 *  pointing the user at the Share sheet → Add to Home Screen, since iOS
 *  Safari has no `beforeinstallprompt` equivalent.
 *
 * Gated on `localStorage["i-muslim-visit-count"] >= 3` so users get to feel
 * out the app before the prompt asks. Dismissal is sticky (no re-prompt).
 *
 * Mounted at the top of the (site) layout so it sits above the prayer bar
 * on every public route. `md:hidden` keeps it off desktop entirely — desktop
 * users have a browser-chrome install button already.
 */
export function InstallPrompt() {
  const t = useTranslations("install");

  // SSR-safe client-runtime flags. `useSyncExternalStore` returns the
  // serverSnapshot value during SSR and on the very first client render
  // (so hydration matches), then transitions to the live value on the
  // next render — avoiding both hydration warnings and the React 19
  // "setState in effect" rule the previous useState+useEffect pattern
  // tripped.
  const visits = useSyncExternalStore(
    subscribeStorage,
    readVisits,
    () => 0,
  );
  const dismissed = useSyncExternalStore(
    subscribeStorage,
    readDismissed,
    () => true,
  );
  const standalone = useSyncExternalStore(
    noopSubscribe,
    isStandalone,
    () => true,
  );
  const iosBrowser = useSyncExternalStore(
    noopSubscribe,
    isIOSSafari,
    () => false,
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Increment the visit counter on first mount. Write-only here — the
  // updated value is picked up by the `visits` snapshot above when the
  // synthetic storage event fires the subscriber.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(VISIT_KEY);
      const next = (raw ? parseInt(raw, 10) || 0 : 0) + 1;
      window.localStorage.setItem(VISIT_KEY, String(next));
      window.dispatchEvent(new StorageEvent("storage", { key: VISIT_KEY }));
    } catch {
      // private mode / quota — visits stays at the read value, prompt
      // simply won't fire until the threshold is crossed organically
    }
  }, []);

  // Capture the Android install event. setState lives inside the event
  // handler callback (not the effect body), so it's not flagged by the
  // sync-setState-in-effect rule.
  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "true");
      // Notify the storage subscriber so the snapshot re-reads and the
      // banner unmounts on this same tab (cross-tab is automatic).
      window.dispatchEvent(new StorageEvent("storage", { key: DISMISSED_KEY }));
    } catch {
      // ignore — banner persists, user can dismiss again
    }
  }

  async function install() {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          dismiss();
        }
        setDeferredPrompt(null);
      } catch {
        // user cancelled / browser refused — leave banner in place
      }
      return;
    }
    if (iosBrowser) {
      setShowIOSInstructions(true);
    }
  }

  const eligible =
    visits >= MIN_VISITS &&
    !dismissed &&
    !standalone &&
    (deferredPrompt !== null || iosBrowser);
  if (!eligible) return null;

  return (
    <div data-reading-chrome className="md:hidden mx-auto max-w-6xl px-4 pt-2">
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
        <Download className="size-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{t("title")}</p>
          {showIOSInstructions ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t.rich("iosInstructions", {
                share: () => (
                  <Share className="inline size-3.5 align-text-bottom mx-0.5" />
                ),
              })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          )}
        </div>
        {!showIOSInstructions && (
          <Button size="sm" onClick={install}>
            {t("install")}
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="touch-target-sm inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
