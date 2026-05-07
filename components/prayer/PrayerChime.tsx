"use client";

import { useEffect, useRef } from "react";
import { usePrayerTimes } from "@/lib/prayer/use-prayer-times";

const STORAGE_KEY = "i-muslim-prayer-chime";
// Soft 880 Hz tone with ~600 ms envelope. Synthesized rather than served as
// an mp3 so the SW + bundle stay small and there's no audio-licensing call to
// make. Two-note sequence (perfect fifth) reads as a chime, not an alarm.
const TONES_HZ = [880, 1318.5];
const TONE_MS = 350;
const TONE_GAP_MS = 80;
const VIBRATE_MS = 200;

interface AudioContextWindow extends Window {
  AudioContext: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as AudioContextWindow;
  const Ctor = w.AudioContext || w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  TONES_HZ.forEach((hz, i) => {
    const start = now + (i * (TONE_MS + TONE_GAP_MS)) / 1000;
    const stop = start + TONE_MS / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    // Envelope: fast attack, soft release — avoids the click you'd get from
    // a hard on/off on an oscillator.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.linearRampToValueAtTime(0, stop);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(stop);
  });
}

/**
 * Plays a soft synthesized chime + a 200 ms vibration at every prayer-time
 * transition. Mounted once in the (site) layout so it watches the next prayer
 * regardless of which route the user is on.
 *
 * AudioContext is created lazily on the first user interaction (autoplay
 * policies — Chrome and iOS Safari refuse to start an AudioContext that hasn't
 * been resumed inside a user gesture). After that, scheduled chimes fire
 * silently from `setTimeout` callbacks. If the user never interacts with the
 * page, the chime won't sound — `navigator.vibrate` still fires where
 * supported, and the visual countdown on PrayerPills still updates.
 *
 * Gated on `localStorage["i-muslim-prayer-chime"] !== "off"` so users can
 * silence it via DevTools or a future toggle in /more without redeploying.
 * Default-on because this is a Muslim app — the chime IS the feature.
 */
export function PrayerChime() {
  const { effectivePrefs, today, tomorrow, next } = usePrayerTimes({
    autoDetect: false,
  });
  const ctxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Lazy AudioContext — created on the first tap/click anywhere, after which
  // it stays unlocked for the page lifetime. We also try to resume it on
  // visibility-change so a backgrounded tab can fire its chime when foregrounded.
  useEffect(() => {
    function unlock() {
      if (!ctxRef.current) ctxRef.current = getAudioContext();
      if (ctxRef.current && ctxRef.current.state === "suspended") {
        ctxRef.current.resume().catch(() => {});
      }
    }
    const opts: AddEventListenerOptions = { once: false, passive: true };
    window.addEventListener("pointerdown", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    document.addEventListener("visibilitychange", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      document.removeEventListener("visibilitychange", unlock);
    };
  }, []);

  // Compute target prayer-time as a primitive so the dep array stays static
  // and the React Compiler can verify it. Returns null when we don't have
  // enough state to schedule.
  const targetMs =
    next && today && tomorrow
      ? (next.isTomorrow ? tomorrow[next.key] : today[next.key]).getTime()
      : null;
  const hasPrefs = !!effectivePrefs;

  // Schedule the next chime whenever the target time changes (which it does
  // as the ticker rolls past a prayer). Re-arms automatically.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasPrefs || targetMs === null) return;
    if (window.localStorage.getItem(STORAGE_KEY) === "off") return;

    const ms = targetMs - Date.now();
    // Don't try to schedule absurdly-far prayers (browser timer cap is ~24
    // days but values past 60 minutes are also likely to be re-derived
    // before they fire as the ticker re-runs).
    if (ms <= 0 || ms > 60 * 60 * 1000) return;

    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      try {
        if (ctxRef.current) playChime(ctxRef.current);
      } catch {
        // AudioContext may be locked / closed — fail silently
      }
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(VIBRATE_MS);
      }
    }, ms);

    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [hasPrefs, targetMs]);

  return null;
}
