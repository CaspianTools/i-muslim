"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { MessageSquare, StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TabKey = "comments" | "notes";

export const HADITH_DETAIL_TABS_ANCHOR = "hadith-tabs";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function getHashTab(): TabKey {
  if (typeof window === "undefined") return "comments";
  const h = window.location.hash.replace(/^#/, "");
  return h === "notes" ? "notes" : "comments";
}

interface Props {
  commentsSlot: ReactNode;
  notesSlot: ReactNode;
  initialCommentCount?: number;
}

/**
 * Tabbed Comments + Notes surface that lives below the HadithCard on the
 * permalink page. The active tab is derived from `location.hash` via
 * useSyncExternalStore, so the card-header scroll-to-tab anchors
 * (interactionMode="scroll-to-tab" on HadithCard) drive the tab purely by
 * setting `#comments` / `#notes` — no extra state to sync.
 */
export function HadithDetailTabs({
  commentsSlot,
  notesSlot,
  initialCommentCount = 0,
}: Props) {
  const t = useTranslations("hadithPage");
  const active = useSyncExternalStore(
    subscribeHash,
    getHashTab,
    () => "comments" as TabKey,
  );

  function onValueChange(v: string) {
    const next: TabKey = v === "notes" ? "notes" : "comments";
    if (typeof window === "undefined") return;
    const target = `#${next}`;
    if (window.location.hash === target) return;
    // pushState triggers no popstate; we manually dispatch hashchange so
    // useSyncExternalStore notices and re-derives `active`.
    history.replaceState(null, "", target);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  return (
    <section
      id={HADITH_DETAIL_TABS_ANCHOR}
      className="mt-10 border-t border-border pt-6 scroll-mt-24"
      aria-label={t("singleTabsComments")}
    >
      <Tabs value={active} onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="comments" className="gap-2">
            <MessageSquare className="size-4" />
            <span>
              {t("singleTabsComments")}
              {initialCommentCount > 0 ? ` (${initialCommentCount})` : ""}
            </span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="size-4" />
            <span>{t("singleTabsNotes")}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="comments">{commentsSlot}</TabsContent>
        <TabsContent value="notes">{notesSlot}</TabsContent>
      </Tabs>
    </section>
  );
}
