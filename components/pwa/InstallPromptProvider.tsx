"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface InstallPromptValue {
  /** A native install prompt is available (Android / desktop Chromium). */
  canInstall: boolean;
  /** Trigger the native install prompt; resolves once the user responds. */
  install: () => Promise<void>;
  /** The bottom banner should show (installable AND not yet dismissed). */
  bannerVisible: boolean;
  /** Hide the banner for good (persisted in localStorage). */
  dismissBanner: () => void;
}

const InstallPromptContext = createContext<InstallPromptValue>({
  canInstall: false,
  install: async () => {},
  bannerVisible: false,
  dismissBanner: () => {},
});

export const useInstallPrompt = () => useContext(InstallPromptContext);

const DISMISS_KEY = "masjid-install-dismissed";

/**
 * Captures the browser's deferred `beforeinstallprompt` event once and shares it
 * with every consumer — the bottom install banner and the nav-drawer "Install"
 * item — so the PWA can be installed from either without each grabbing its own
 * copy of the single-use event. iOS Safari never fires the event, so `canInstall`
 * stays false there (install is via Share → Add to Home Screen). Without this
 * provider the default context is inert (`canInstall: false`), so consumers on
 * pages that don't wrap it simply render nothing.
 */
export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  // Assume dismissed until localStorage is read on mount, so the banner never
  // flashes before we know the user's choice.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Read the persisted dismissal after mount, deferred so it isn't a
    // synchronous setState inside the effect body (which can cascade renders).
    let isDismissed = false;
    try {
      isDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      isDismissed = false;
    }
    const id = setTimeout(() => setDismissed(isDismissed), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!evt) return;
    await evt.prompt();
    // Keep the affordance if the user dismissed the native prompt; only discard
    // the (single-use) event on accept. `appinstalled` also clears it.
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") setEvt(null);
  }, [evt]);

  const dismissBanner = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage unavailable (private mode) — banner just won't persist.
    }
  }, []);

  const canInstall = evt != null;
  return (
    <InstallPromptContext.Provider
      value={{ canInstall, install, bannerVisible: canInstall && !dismissed, dismissBanner }}
    >
      {children}
    </InstallPromptContext.Provider>
  );
}
