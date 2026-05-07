"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Compass, MapPin, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ALL_METHODS, pickDefaultMethod, pickDefaultMadhab } from "@/lib/prayer/methods";
import { readPrefs, writePrefs } from "@/lib/prayer/storage";
import { requestBrowserLocation } from "@/lib/prayer/location";
import { tzToCity } from "@/lib/prayer/tz-country";
import { detectClientTimeZone } from "@/lib/prayer/location";
import type { MethodKey } from "@/lib/prayer/engine";

const ONBOARDED_KEY = "i-muslim-onboarded";
const ONBOARDED_EVENT = "i-muslim-onboarded-change";

async function resolveTzFromCoords(lat: number, lng: number): Promise<string> {
  try {
    const mod = await import("tz-lookup");
    const fn = (mod.default ?? mod) as (a: number, b: number) => string;
    return fn(lat, lng);
  } catch {
    return detectClientTimeZone();
  }
}

function subscribeOnboarded(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(ONBOARDED_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(ONBOARDED_EVENT, cb);
  };
}

function getOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "true";
  } catch {
    return true;
  }
}

// Server snapshot returns `true` so SSR renders the dialog closed (no flash,
// no SEO-visible modal markup). The client read kicks in after hydration via
// useSyncExternalStore.
const getOnboardedServer = () => true;

/**
 * First-run welcome modal. Two-step UX (location → calculation method) — the
 * audit asked for language as a third step, but the URL `[locale]` segment is
 * already the canonical source of truth so a language step inside the modal
 * would create a chicken-and-egg with next-intl. Notification permission is
 * deferred until the user has had a chance to use the app.
 *
 * Hydration-safe: we render `<Dialog open={false}>` until a `useEffect` reads
 * localStorage on the client. This keeps SSR shipping the real public content
 * (SEO-safe, deep-link-safe — sharing /quran/2 still lands on /quran/2 with
 * the modal overlaying), and avoids a flash of dialog before the layout
 * paints.
 */
export function OnboardingModal() {
  const t = useTranslations("onboarding");
  const onboarded = useSyncExternalStore(
    subscribeOnboarded,
    getOnboarded,
    getOnboardedServer,
  );
  const [step, setStep] = useState<0 | 1>(0);
  const [locating, setLocating] = useState(false);
  const [method, setMethod] = useState<MethodKey>(
    () => readPrefs()?.method ?? "MuslimWorldLeague",
  );

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "true");
      window.dispatchEvent(new Event(ONBOARDED_EVENT));
    } catch {
      // ignore storage failures — user can re-onboard next visit
    }
  }, []);

  async function useMyLocation() {
    setLocating(true);
    try {
      const pos = await requestBrowserLocation({ enableHighAccuracy: false });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const tz = await resolveTzFromCoords(lat, lng);
      const tzCity = tzToCity(tz);
      const cc = tzCity?.countryCode ?? null;
      writePrefs({
        method: pickDefaultMethod(cc),
        madhab: pickDefaultMadhab(cc),
        coords: { lat, lng },
        city: tzCity?.city ?? null,
        countryCode: cc,
        tz,
        source: "browser",
      });
      // Pre-select the country-suggested method on step 2.
      setMethod(pickDefaultMethod(cc));
      setStep(1);
    } catch {
      // Permission denied or unavailable — fall through to step 2 anyway,
      // the prayer-times hook's IP/TZ auto-detection will fill in coords.
      setStep(1);
    } finally {
      setLocating(false);
    }
  }

  function applyMethodAndFinish() {
    const existing = readPrefs();
    if (existing) {
      writePrefs({ ...existing, method, source: "manual" });
    }
    finish();
  }

  return (
    <Dialog open={!onboarded} onOpenChange={(open) => !open && finish()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 inline-flex size-12 items-center justify-center rounded-full bg-[var(--selected)] text-[var(--selected-foreground)]">
            <Sparkles className="size-6" />
          </div>
          <DialogTitle className="text-center">
            {step === 0 ? t("welcomeTitle") : t("methodTitle")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 0 ? t("welcomeDescription") : t("methodDescription")}
          </DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={useMyLocation}
              disabled={locating}
            >
              <MapPin className="size-4" />
              {locating ? t("locating") : t("useMyLocation")}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full"
              onClick={() => setStep(1)}
              disabled={locating}
            >
              {t("approximateLocation")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("locationPrivacyNote")}
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <label
              htmlFor="onboarding-method"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              <Compass className="inline size-3.5 me-1" />
              {t("methodLabel")}
            </label>
            <select
              id="onboarding-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as MethodKey)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {ALL_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/([A-Z])/g, " $1").trim()}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("methodHint")}</p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep(0)}
                className="flex-1"
              >
                {t("back")}
              </Button>
              <Button onClick={applyMethodAndFinish} className="flex-1">
                {t("getStarted")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
