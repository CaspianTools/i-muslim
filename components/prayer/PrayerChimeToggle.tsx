"use client";

import { useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "i-muslim-prayer-chime";
const CHANGE_EVENT = "i-muslim-prayer-chime-change";

const subscribe = (cb: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (!e.key || e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
};

const readEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
};

// Server snapshot: assume on, since the chime is default-on. Render won't
// flicker on hydration because the visual difference is just an icon swap.
const readEnabledServer = () => true;

/**
 * Inline switch for the soft prayer-time chime + haptic. Default-on; this
 * toggle is the user-facing way to mute it without DevTools. Read/write live
 * across tabs via the same `useSyncExternalStore` + synthetic StorageEvent
 * pattern the InstallPrompt and OnboardingModal landed on.
 */
export function PrayerChimeToggle() {
  const t = useTranslations("more");
  const enabled = useSyncExternalStore(subscribe, readEnabled, readEnabledServer);

  function toggle() {
    try {
      if (enabled) {
        window.localStorage.setItem(STORAGE_KEY, "off");
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // ignore — toggle has no fallback path
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? t("chimeOn") : t("chimeOff")}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:border-accent"
    >
      {enabled ? (
        <Bell className="size-4 text-primary" />
      ) : (
        <BellOff className="size-4 text-muted-foreground" />
      )}
      <span>{enabled ? t("chimeOn") : t("chimeOff")}</span>
    </button>
  );
}
