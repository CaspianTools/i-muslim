"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { exportLocalReads, resetLocalReads } from "@/lib/reads/local";

/**
 * Runs once when a signed-in user lands on the profile shell. If they have
 * any read marks stored locally (from a previous anonymous session), POSTs
 * them to /api/reads/migrate and clears localStorage on success.
 *
 * Mounted only inside the signed-in profile layout, so we never trigger this
 * for visitors who are still anonymous.
 */
export function ReadsMigrationOnSignIn() {
  const ran = useRef(false);
  const t = useTranslations("reads");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const items = exportLocalReads();
    if (items.length === 0) return;
    const payload = items.map((it) => ({ readId: it.readId, readAt: it.readAt }));
    void (async () => {
      try {
        const res = await fetch("/api/reads/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; added?: number };
        if (data.ok) {
          resetLocalReads();
          const added = data.added ?? 0;
          if (added > 0) toast.success(t("migrationToast", { count: added }));
        }
      } catch {
        // Non-blocking: keep local data; retry on next profile visit.
      }
    })();
  }, [t]);

  return null;
}
