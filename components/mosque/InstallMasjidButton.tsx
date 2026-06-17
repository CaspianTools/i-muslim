"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * In-page install button for the masjid PWA. Appears on browsers that fire
 * `beforeinstallprompt` (Android Chrome, desktop Chrome/Edge). iOS Safari doesn't
 * fire it — there the page is installed via the native Share → Add to Home
 * Screen, which the per-masjid manifest + apple-touch-icon metadata support.
 */
export function InstallMasjidButton() {
  const t = useTranslations("mosques.install");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  return (
    <Button
      size="sm"
      variant="secondary"
      className="h-10 w-10 px-0 sm:h-8 sm:w-auto sm:px-3"
      onClick={async () => {
        await promptEvent.prompt();
        setPromptEvent(null);
      }}
      aria-label={t("install")}
    >
      <Download className="size-4" />
      <span className="hidden sm:inline">{t("install")}</span>
    </Button>
  );
}
