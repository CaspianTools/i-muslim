"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  ALL_LANGS,
  LANG_LABELS,
  parseLangsParam,
  serializeLangs,
} from "@/lib/translations";
import type { LangCode } from "@/lib/translations";

const STORAGE_KEY = "i-muslim.langs";

type LanguageSelectorProps = {
  // When provided, only these translation languages appear as toggle buttons.
  // The user's currently-selected languages are still respected via ?lang=
  // (deep links keep working) — the prop only filters the picker UI.
  availableLangs?: readonly LangCode[];
};

export function LanguageSelector({ availableLangs }: LanguageSelectorProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = parseLangsParam(searchParams.get("lang"));
  const visible: readonly LangCode[] = availableLangs
    ? ALL_LANGS.filter((l) => availableLangs.includes(l) || current.includes(l))
    : ALL_LANGS;

  // On first mount, if URL has no ?lang= but localStorage remembers a
  // preference, push a redirect so the server rerenders with saved prefs.
  useEffect(() => {
    if (searchParams.get("lang")) return;
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = parseLangsParam(saved);
    if (parsed.length === 0) return;
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("lang", serializeLangs(parsed));
    router.replace(`${pathname}?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(lang: LangCode) {
    const set = new Set(current);
    if (set.has(lang)) {
      set.delete(lang);
    } else {
      set.add(lang);
    }
    // At least one language must remain selected; if user toggles off the
    // last one, restore Arabic as a sensible default for sacred text.
    if (set.size === 0) set.add("ar");
    const next = Array.from(set) as LangCode[];
    const ordered = ALL_LANGS.filter((l) => next.includes(l));
    const serialized = serializeLangs(ordered);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    }
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("lang", serialized);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        Translations:
      </span>
      {visible.map((lang) => {
        const active = current.includes(lang);
        return (
          <button
            key={lang}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(lang)}
            className={
              active
                ? "rounded-full border border-accent bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                : "rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            }
          >
            {LANG_LABELS[lang]}
          </button>
        );
      })}
    </div>
  );
}
