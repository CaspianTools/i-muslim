"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ReadingScope = "quran" | "hadith";
export type ReaderFontKind = "arabic" | "translation";

const MODE_STORAGE_KEYS: Record<ReadingScope, string> = {
  quran: "reading-mode:quran",
  hadith: "reading-mode:hadith",
};
const MODE_EVENT = "reading-mode-change";

const FONT_STORAGE_KEYS: Record<ReaderFontKind, string> = {
  arabic: "reading-mode:font-arabic",
  translation: "reading-mode:font-translation",
};
const FONT_EVENT = "reading-mode-font-change";

export const FONT_DEFAULTS: Record<ReaderFontKind, number> = {
  arabic: 32,
  translation: 17,
};
export const FONT_BOUNDS: Record<ReaderFontKind, { min: number; max: number; step: number }> = {
  arabic: { min: 20, max: 56, step: 2 },
  translation: { min: 13, max: 28, step: 1 },
};

function readMode(scope: ReadingScope): boolean {
  try {
    return window.localStorage.getItem(MODE_STORAGE_KEYS[scope]) === "1";
  } catch {
    return false;
  }
}

function writeMode(scope: ReadingScope, on: boolean) {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEYS[scope], on ? "1" : "0");
    window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { scope } }));
  } catch {
    // ignore
  }
}

function subscribeMode(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(MODE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(MODE_EVENT, cb);
  };
}

export function useReadingMode(scope: ReadingScope): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribeMode,
    () => readMode(scope),
    () => false,
  );
  const set = useCallback(
    (next: boolean) => writeMode(scope, next),
    [scope],
  );
  return [value, set];
}

function clampFont(kind: ReaderFontKind, raw: number): number {
  const { min, max } = FONT_BOUNDS[kind];
  if (!Number.isFinite(raw)) return FONT_DEFAULTS[kind];
  return Math.min(max, Math.max(min, Math.round(raw)));
}

function readFont(kind: ReaderFontKind): number {
  try {
    const raw = window.localStorage.getItem(FONT_STORAGE_KEYS[kind]);
    if (raw == null) return FONT_DEFAULTS[kind];
    return clampFont(kind, Number(raw));
  } catch {
    return FONT_DEFAULTS[kind];
  }
}

function writeFont(kind: ReaderFontKind, value: number) {
  try {
    window.localStorage.setItem(FONT_STORAGE_KEYS[kind], String(clampFont(kind, value)));
    window.dispatchEvent(new CustomEvent(FONT_EVENT, { detail: { kind } }));
  } catch {
    // ignore
  }
}

function subscribeFont(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(FONT_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(FONT_EVENT, cb);
  };
}

export function useReaderFont(kind: ReaderFontKind): [number, (next: number) => void] {
  const value = useSyncExternalStore(
    subscribeFont,
    () => readFont(kind),
    () => FONT_DEFAULTS[kind],
  );
  const set = useCallback((next: number) => writeFont(kind, next), [kind]);
  return [value, set];
}

export function bumpReaderFont(kind: ReaderFontKind, delta: 1 | -1) {
  const current = readFont(kind);
  const { step } = FONT_BOUNDS[kind];
  writeFont(kind, current + delta * step);
}
