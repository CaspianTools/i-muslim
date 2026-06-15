"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { getClientApp } from "@/lib/firebase/client";

/** Web push is only available once a VAPID key is configured. */
export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
}

/**
 * Request notification permission, obtain an FCM web-push token, and register it
 * server-side. Returns false (no-op) when push isn't configured, isn't
 * supported, or the user declines — callers treat it as best-effort.
 */
export async function enablePush(): Promise<boolean> {
  try {
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return false;
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    if (!(await isSupported().catch(() => false))) return false;

    const app = getClientApp();
    if (!app) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // No explicit serviceWorkerRegistration → FCM auto-registers
    // /firebase-messaging-sw.js at its own scope, avoiding the app's main sw.js.
    const token = await getToken(getMessaging(app), { vapidKey });
    if (!token) return false;

    await fetch("/api/push/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return true;
  } catch (err) {
    console.warn("[push] enable failed:", err);
    return false;
  }
}
