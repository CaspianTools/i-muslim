"use client";

import { useSyncExternalStore } from "react";
import { Bell, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "i-muslim-notif-dismissed";
const CHANGE_EVENT = "i-muslim-notif-dismissed-change";

const subscribe = (cb: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (!e.key || e.key === DISMISSED_KEY) cb();
  };
  window.addEventListener("storage", handler);
  window.addEventListener(CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(CHANGE_EVENT, cb);
  };
};

const readPermission = (): NotificationPermission | "unsupported" => {
  if (typeof window === "undefined") return "unsupported";
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
};

const readDismissed = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return true;
  }
};

const noopSub = (): (() => void) => () => {};
const readPermissionServer = () => "unsupported" as const;
const readDismissedServer = () => true;

/**
 * Contextual notification-permission ask. Shown only on /prayer-times — the
 * page where the user most plausibly *wants* prayer reminders, so the
 * permission ask has a clear reason behind it. Asking from a generic
 * onboarding modal has worse opt-in rates and a denied early request locks
 * out re-prompting forever.
 *
 * Renders nothing if:
 *  - The browser doesn't support the Notification API
 *  - Permission is already `granted` (chime + Notification both fire from
 *    PrayerChime in that case)
 *  - Permission is `denied` (re-prompting is impossible — show nothing
 *    rather than a sad reminder of the locked state)
 *  - User dismissed the card via the X
 */
export function NotificationPermissionCard() {
  const t = useTranslations("prayer.notify");
  const permission = useSyncExternalStore(noopSub, readPermission, readPermissionServer);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, readDismissedServer);

  if (permission !== "default" || dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "true");
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // ignore
    }
  }

  async function request() {
    try {
      // The user gesture is the click — calling requestPermission inside the
      // handler is required by the spec. We don't act on the result; the
      // useSyncExternalStore subscriber on the static permission value won't
      // re-render automatically (no event), so the card stays visible until
      // the user navigates or dismisses. That's acceptable because the
      // returned status is already saved by the browser at this point.
      await Notification.requestPermission();
      // Best-effort dismiss either way — denied users shouldn't see this card
      // again, granted users no longer need it.
      dismiss();
    } catch {
      // ignore
    }
  }

  return (
    <div className="mb-6 flex items-start gap-3 rounded-md border border-border bg-card p-4">
      <Bell className="size-5 shrink-0 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={request}>
            {t("enable")}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            {t("notNow")}
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="touch-target-sm inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
