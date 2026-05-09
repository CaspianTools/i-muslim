"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import type { LangCode } from "@/lib/translations";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { QuranSidebar } from "./QuranSidebar";

const COLLAPSE_KEY = "quran:sidebar-collapsed";
const COLLAPSE_EVENT = "quran:sidebar-collapsed-change";

function subscribeCollapse(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(COLLAPSE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(COLLAPSE_EVENT, cb);
  };
}

function getCollapse(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

interface Props {
  availableLangs: readonly LangCode[];
}

/**
 * Filter trigger that lives in the surah header beside the Kaydet button.
 * - On `<md`: opens the existing sidebar inside a Sheet (drawer).
 * - On `>=md`: toggles the persistent desktop sidebar (state stored in
 *   localStorage so it survives navigation; QuranSidebar reads the same key).
 *
 * The single button instance handles both viewports; CSS does not pick — the
 * click handler does, based on a media query at click time. This keeps the
 * trigger position identical across breakpoints.
 */
export function QuranFiltersButton({ availableLangs }: Props) {
  const t = useTranslations("quranSidebar");
  const [sheetOpen, setSheetOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapse, getCollapse, () => false);

  const handleClick = useCallback(() => {
    const isDesktop =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) {
      try {
        const next = !collapsed;
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
        window.dispatchEvent(new Event(COLLAPSE_EVENT));
      } catch {
        // ignore
      }
      return;
    }
    setSheetOpen(true);
  }, [collapsed]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("menu")}
        title={t("menu")}
        aria-pressed={!collapsed}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border ui-selected-chip-idle transition-colors"
      >
        <SlidersHorizontal className="size-4" />
      </button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetTitle className="sr-only">{t("title")}</SheetTitle>
          <QuranSidebar
            variant="drawer"
            availableLangs={availableLangs}
            onNavigate={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
