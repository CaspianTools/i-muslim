"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeDailyTimes,
  getCurrentPrayer,
  getNextPrayer,
  type Coords,
  type DailyTimes,
  type NextPrayer,
  type PrayerKey,
} from "./engine";
import {
  detectClientTimeZone,
  fetchIpLocation,
  geolocationPermissionState,
  requestBrowserLocation,
} from "./location";
import { pickDefaultMadhab, pickDefaultMethod } from "./methods";
import {
  readPrefs,
  usePrayerPrefs,
  writePrefs,
  type PrayerPrefs,
} from "./storage";
import { useNow } from "./ticker";
import { tzToCity } from "./tz-country";

async function resolveTzFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const mod = await import("tz-lookup");
    const fn = (mod.default ?? mod) as (a: number, b: number) => string;
    return fn(lat, lng);
  } catch {
    return detectClientTimeZone();
  }
}

export interface UsePrayerTimesOptions {
  fallback?: PrayerPrefs;
  autoDetect?: boolean;
}

export interface UsePrayerTimesResult {
  prefs: PrayerPrefs | null;
  effectivePrefs: PrayerPrefs | null;
  today: DailyTimes | null;
  tomorrow: DailyTimes | null;
  next: NextPrayer | null;
  current: PrayerKey | null;
  now: Date | null;
  autoBusy: boolean;
}

export function usePrayerTimes(
  options: UsePrayerTimesOptions = {},
): UsePrayerTimesResult {
  const { fallback, autoDetect = true } = options;
  const stored = usePrayerPrefs();
  const effective = stored ?? fallback ?? null;
  const [autoBusy, setAutoBusy] = useState(false);

  useEffect(() => {
    if (!autoDetect) return;
    if (typeof window === "undefined") return;
    if (readPrefs()) return;

    let cancelled = false;
    (async () => {
      setAutoBusy(true);
      try {
        const permState = await geolocationPermissionState();
        if (permState === "granted" && !cancelled) {
          try {
            const pos = await requestBrowserLocation({
              enableHighAccuracy: false,
            });
            if (cancelled) return;
            const c: Coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
            const tz = await resolveTzFromCoords(c.lat, c.lng);
            const tzCity = tzToCity(tz);
            const cc = tzCity?.countryCode ?? null;
            writePrefs({
              method: pickDefaultMethod(cc),
              madhab: pickDefaultMadhab(cc),
              coords: c,
              city: tzCity?.city ?? null,
              countryCode: cc,
              tz,
              source: "browser",
            });
            return;
          } catch {
            // fall through
          }
        }

        const ip = await fetchIpLocation();
        if (cancelled) return;
        if (ip) {
          writePrefs({
            method: pickDefaultMethod(ip.countryCode),
            madhab: pickDefaultMadhab(ip.countryCode),
            coords: ip.coords,
            city: ip.city,
            countryCode: ip.countryCode,
            tz: ip.tz,
            source: "auto-ip",
          });
          return;
        }

        const tz = detectClientTimeZone();
        const tzCity = tzToCity(tz);
        if (tzCity && !cancelled) {
          writePrefs({
            method: pickDefaultMethod(tzCity.countryCode),
            madhab: pickDefaultMadhab(tzCity.countryCode),
            coords: { lat: tzCity.lat, lng: tzCity.lng },
            city: tzCity.city,
            countryCode: tzCity.countryCode,
            tz,
            source: "auto-tz",
          });
        }
      } finally {
        if (!cancelled) setAutoBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoDetect]);

  const now = useNow(30_000);
  const renderDate = now ?? new Date();
  const renderDayKey = renderDate.toDateString();

  const today = useMemo<DailyTimes | null>(() => {
    if (!effective) return null;
    return computeDailyTimes({
      date: renderDate,
      coords: effective.coords,
      method: effective.method,
      madhab: effective.madhab,
      tz: effective.tz,
      highLatitudeRule: effective.highLatitudeRule,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    renderDayKey,
    effective?.coords.lat,
    effective?.coords.lng,
    effective?.method,
    effective?.madhab,
    effective?.tz,
    effective?.highLatitudeRule,
  ]);

  const tomorrow = useMemo<DailyTimes | null>(() => {
    if (!effective || !today) return null;
    const tomorrowDate = new Date(renderDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    return computeDailyTimes({
      date: tomorrowDate,
      coords: effective.coords,
      method: effective.method,
      madhab: effective.madhab,
      tz: effective.tz,
      highLatitudeRule: today.highLatRuleAuto
        ? undefined
        : today.highLatRuleApplied,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    renderDayKey,
    effective?.coords.lat,
    effective?.coords.lng,
    effective?.method,
    effective?.madhab,
    effective?.tz,
    today?.highLatRuleApplied,
    today?.highLatRuleAuto,
  ]);

  const next = useMemo<NextPrayer | null>(() => {
    if (!now || !today || !tomorrow) return null;
    return getNextPrayer(now, today, tomorrow);
  }, [now, today, tomorrow]);

  const current = useMemo<PrayerKey | null>(() => {
    if (!now || !today) return null;
    return getCurrentPrayer(now, today);
  }, [now, today]);

  return {
    prefs: stored,
    effectivePrefs: effective,
    today,
    tomorrow,
    next,
    current,
    now,
    autoBusy,
  };
}
