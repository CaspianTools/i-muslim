"use client";

import { useRouter, usePathname } from "next/navigation";
import { Printer } from "lucide-react";
import { BUNDLED_LOCALES, LOCALE_META, type Locale } from "@/i18n/config";

/**
 * Screen-only controls for the printable masjid poster: a language picker (the
 * manager prints in the language their community reads) and a Print / Save-as-PDF
 * button. Tagged `no-print` so neither appears on paper — the sheet stays clean.
 */
export function PosterToolbar({
  current,
  languageLabel,
  printLabel,
}: {
  current: Locale;
  languageLabel: string;
  printLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Always include the active locale so the <select> has a matching option even
  // if the poster was opened in a non-bundled language via `?lang=`.
  const langs = Array.from(new Set<Locale>([...BUNDLED_LOCALES, current]));

  return (
    <div className="no-print mq-poster-toolbar">
      <label>
        <span>{languageLabel}</span>
        <select
          value={current}
          onChange={(e) => {
            const params = new URLSearchParams(window.location.search);
            params.set("lang", e.target.value);
            router.replace(`${pathname}?${params.toString()}`);
          }}
        >
          {langs.map((l) => (
            <option key={l} value={l}>
              {LOCALE_META[l].nativeName}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="mq-poster-print" onClick={() => window.print()}>
        <Printer className="size-4" /> {printLabel}
      </button>
    </div>
  );
}
