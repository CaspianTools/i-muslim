import "server-only";
import { getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { requireDb } from "@/lib/firebase/admin";
import { getSiteUrl } from "@/lib/mosques/constants";
import { listFollowerUids } from "@/lib/mosques/follows";
import { getTokensForUids, deletePushToken } from "@/lib/push/tokens";

function getAdminMessaging() {
  try {
    requireDb(); // ensures the admin app singleton is initialized
    const app = getApps().find((a) => a.name === "i-muslim-admin");
    if (!app) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}

/**
 * Best-effort fan-out of a notification to every follower of a masjid. Uses the
 * existing admin service account (no extra server config); only delivers to
 * users who registered an FCM web-push token (which needs the client VAPID key).
 * Dead tokens are pruned. Safe to call even when nothing is configured — it
 * simply finds no tokens and returns.
 */
export async function sendPushToFollowers(
  slug: string,
  code: string | undefined,
  payload: { title: string; body: string },
): Promise<void> {
  const messaging = getAdminMessaging();
  if (!messaging) return;

  const uids = await listFollowerUids(slug);
  if (uids.length === 0) return;
  const tokens = await getTokensForUids(uids);
  if (tokens.length === 0) return;

  const link = code ? `${getSiteUrl()}/m/${code}` : `${getSiteUrl()}/mosques/${slug}`;

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: payload.title, body: payload.body },
        webpush: {
          notification: { icon: "/icons/icon-192.png" },
          fcmOptions: { link },
        },
      });
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          const codeStr = r.error?.code ?? "";
          if (
            codeStr.includes("registration-token-not-registered") ||
            codeStr.includes("invalid-registration-token") ||
            codeStr.includes("invalid-argument")
          ) {
            void deletePushToken(batch[idx]!);
          }
        }
      });
    } catch (err) {
      console.warn("[push] multicast failed:", err);
    }
  }
}
