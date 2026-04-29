"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ChevronLeft, Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LangCode } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { QuranLanguageFilter } from "./QuranLanguageFilter";

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

function useCollapse(enabled: boolean): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(subscribeCollapse, getCollapse, () => false);
  const setValue = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event(COLLAPSE_EVENT));
    } catch {
      // ignore
    }
  }, []);
  return [enabled ? value : false, setValue];
}

interface QuranSidebarProps {
  variant?: "desktop" | "drawer";
  availableLangs: readonly LangCode[];
  onNavigate?: () => void;
}

export function QuranSidebar({
  variant = "desktop",
  availableLangs,
  onNavigate: _onNavigate,
}: QuranSidebarProps) {
  void _onNavigate;
  const [collapsed, setCollapsed] = useCollapse(variant === "desktop");
  const t = useTranslations("quranSidebar");

  const showLabels = variant === "drawer" || !collapsed;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex flex-col bg-card text-foreground rounded-lg border border-border overflow-hidden",
          variant === "desktop" && (collapsed ? "w-16" : "w-[260px]"),
          variant === "desktop" && "max-h-[calc(100vh-6rem)]",
          variant === "drawer" && "w-full h-full rounded-none border-0",
          "transition-[width] duration-200",
        )}
        aria-label={t("title")}
        role="complementary"
      >
        <div
          className={cn(
            "flex h-12 items-center border-b border-border px-3 shrink-0",
            showLabels ? "justify-between" : "justify-center",
          )}
        >
          {showLabels && <span className="text-sm font-semibold">{t("title")}</span>}
          {variant === "desktop" && showLabels && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("collapse")}
              onClick={() => setCollapsed(true)}
              className="h-8 w-8"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className={cn("py-3", showLabels ? "px-3" : "px-2")}>
            {showLabels ? (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Globe className="size-3.5" />
                  {t("sections.translations")}
                </h3>
                <QuranLanguageFilter availableLangs={availableLangs} />
              </section>
            ) : (
              <ul className="space-y-1">
                <li>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setCollapsed(false)}
                        aria-label={t("sections.translations")}
                        className="flex h-9 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
                      >
                        <Globe className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {t("sections.translations")}
                    </TooltipContent>
                  </Tooltip>
                </li>
              </ul>
            )}
          </div>
        </ScrollArea>

        {!showLabels && variant === "desktop" && (
          <div className="border-t border-border p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="flex h-8 w-full items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                  aria-label={t("expand")}
                >
                  <ChevronLeft className="size-4 rotate-180 rtl:rotate-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("expand")}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
