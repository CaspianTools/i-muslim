"use client";

import { useTranslations } from "next-intl";
import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/components/pwa/InstallPromptProvider";

/**
 * Small, modern, dismissible bottom banner prompting the user to install the
 * masjid as a PWA. Replaces the in-header Install button; reads its state from
 * the shared {@link useInstallPrompt} context. Dismissing it is persisted, so it
 * won't nag again.
 */
export function MasjidInstallPrompt({ name }: { name: string }) {
  const t = useTranslations("mosques.install");
  const { bannerVisible, install, dismissBanner } = useInstallPrompt();
  if (!bannerVisible) return null;

  return (
    <>
      {/* In-flow spacer so the fixed banner never covers the last page content. */}
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-selected text-accent">
            <Download className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{t("bannerTitle")}</p>
            <p className="truncate text-xs text-muted-foreground">{t("bannerSubtitle", { name })}</p>
          </div>
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("install")}
          </button>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label={t("dismiss")}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}
