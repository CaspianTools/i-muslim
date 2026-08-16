"use client";

import { useSyncExternalStore } from "react";
import { BookOpenText, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LangCode } from "@/lib/translations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { QuranLanguageFilter } from "./QuranLanguageFilter";
import { TafsirLanguageFilter } from "@/components/site/tafsir/TafsirLanguageFilter";
import { ReadingFontControls } from "@/components/site/reading/ReadingFontControls";

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

interface QuranSidebarProps {
  variant?: "desktop" | "drawer";
  availableLangs: readonly LangCode[];
  /** Renderable tafsir languages. Empty hides the section entirely. */
  tafsirLangs?: readonly ("ar" | "id")[];
  onNavigate?: () => void;
}

export function QuranSidebar({
  variant = "desktop",
  availableLangs,
  tafsirLangs = [],
  onNavigate: _onNavigate,
}: QuranSidebarProps) {
  void _onNavigate;
  const collapsed = useSyncExternalStore(subscribeCollapse, getCollapse, () => false);
  const t = useTranslations("quranSidebar");
  const tTafsir = useTranslations("tafsir");

  // On desktop, the user can fully hide the sidebar via QuranFiltersButton in
  // the page header; we render nothing in that state so the main column gets
  // the freed width.
  if (variant === "desktop" && collapsed) return null;

  return (
    <div
      className={cn(
        "flex flex-col bg-card text-foreground rounded-lg border border-border overflow-hidden",
        variant === "desktop" && "w-[260px] max-h-[calc(100vh-6rem)]",
        variant === "drawer" && "w-full h-full rounded-none border-0",
      )}
      aria-label={t("title")}
      role="complementary"
    >
      <div className="flex h-12 items-center justify-between border-b border-border px-3 shrink-0">
        <span className="text-sm font-semibold">{t("title")}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-3 space-y-5">
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Globe className="size-3.5" />
              {t("sections.translations")}
            </h3>
            <QuranLanguageFilter availableLangs={availableLangs} />
          </section>
          {tafsirLangs.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <BookOpenText className="size-3.5" />
                {tTafsir("filterLabel")}
              </h3>
              <TafsirLanguageFilter options={tafsirLangs} />
            </section>
          )}
          <ReadingFontControls showTafsir />
        </div>
      </ScrollArea>
    </div>
  );
}
