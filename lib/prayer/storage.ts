"use client";

import { useSyncExternalStore } from "react";
import type {
  Coords,
  HighLatRuleKey,
  MadhabKey,
  MethodKey,
} from "./engine";

const STORAGE_KEY = "i-muslim-prayer-prefs";
const SCHEMA_VERSION = 1;

export interface PrayerPrefs {
  version: 1;
  method: MethodKey;
  madhab: MadhabKey;
  highLatitudeRule?: HighLatRuleKey;
  coords: Coords;
  city: string | null;
  countryCode: string | null;
  tz: string;
  source: "auto-ip" | "auto-tz" | "browser" | "manual" | "fallback";
  updatedAt: string;
}

function isPrefs(value: unknown): value is PrayerPrefs {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return false;
  if (typeof v.method !== "string") return false;
  if (v.madhab !== "shafi" && v.madhab !== "hanafi") return false;
  const c = v.coords as Record<string, unknown> | undefined;
  if (!c || typeof c.lat !== "number" || typeof c.lng !== "number") return false;
  if (typeof v.tz !== "string") return false;
  return true;
}

export function readPrefs(): PrayerPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isPrefs(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writePrefs(p: Omit<PrayerPrefs, "version" | "updatedAt">): PrayerPrefs {
  const full: PrayerPrefs = {
    ...p,
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch {
      // quota / private mode — fall through silently
    }
  }
  return full;
}

export function clearPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {
    // ignore
  }
}

// A calculation method the user explicitly chose during onboarding *before* a
// location (and thus full prefs) existed — e.g. the "Approximate location" path,
// where the actual location is resolved asynchronously by usePrayerTimes'
// auto-detect. That detect adopts this pending method instead of the country
// default when it writes the first prefs, then clears it, so a manual choice
// survives the async race instead of being silently dropped.
const PENDING_METHOD_KEY = "i-muslim-prayer-pending-method";

export function readPendingMethod(): MethodKey | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PENDING_METHOD_KEY);
    return v ? (v as MethodKey) : null;
  } catch {
    return null;
  }
}

export function writePendingMethod(method: MethodKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_METHOD_KEY, method);
  } catch {
    // ignore
  }
}

export function clearPendingMethod(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_METHOD_KEY);
  } catch {
    // ignore
  }
}

const subscribe = (cb: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (!e.key || e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
};

const getSnapshot = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const getServerSnapshot = (): string | null => null;

export function usePrayerPrefs(): PrayerPrefs | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isPrefs(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
