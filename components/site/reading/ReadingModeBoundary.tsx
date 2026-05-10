"use client";

import { useEffect } from "react";
import { useReadingMode, useReaderFont, type ReadingScope } from "@/lib/reading/reading-mode";

/**
 * Mounted on a Quran or Hadith reading page. Translates the per-scope reading
 * preference into a `body.reading-mode-on` class plus a `data-reading-scope`
 * attribute on `<html>`. Globals.css uses these hooks to hide site chrome and
 * scoped in-page chrome (`.reading-hide`).
 *
 * Also reflects the Arabic / translation font sizes onto CSS custom properties
 * so AyahCard and HadithCard can size their text without prop-drilling.
 */
export function ReadingModeBoundary({ scope }: { scope: ReadingScope }) {
  const [active] = useReadingMode(scope);
  const [arabic] = useReaderFont("arabic");
  const [translation] = useReaderFont("translation");

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    if (active) {
      body.classList.add("reading-mode-on");
      html.setAttribute("data-reading-scope", scope);
    } else {
      body.classList.remove("reading-mode-on");
      if (html.getAttribute("data-reading-scope") === scope) {
        html.removeAttribute("data-reading-scope");
      }
    }
    return () => {
      body.classList.remove("reading-mode-on");
      if (html.getAttribute("data-reading-scope") === scope) {
        html.removeAttribute("data-reading-scope");
      }
    };
  }, [active, scope]);

  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty("--reader-arabic-size", `${arabic}px`);
    html.style.setProperty("--reader-translation-size", `${translation}px`);
  }, [arabic, translation]);

  return null;
}
