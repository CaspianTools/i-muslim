"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleMosqueFollow } from "@/app/[locale]/(site)/mosques/follow-actions";
import { enablePush } from "@/lib/push/client";

export function MosqueFollowButton({
  slug,
  initialFollowing,
  signedIn,
}: {
  slug: string;
  initialFollowing: boolean;
  /** Retained for call-site compatibility; the follower total is shown once, in
   *  the cover stats row, so the button no longer renders a count. */
  initialCount?: number;
  signedIn: boolean;
}) {
  const t = useTranslations("mosques.follow");
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      toast.error(t("signInToFollow"));
      return;
    }
    setBusy(true);
    // optimistic
    const next = !following;
    setFollowing(next);
    try {
      const res = await toggleMosqueFollow(slug);
      if (!res.ok) {
        setFollowing(!next);
        toast.error(t("failed"));
        return;
      }
      // On a fresh follow, offer push so the user actually receives updates.
      if (next) void enablePush();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      className="h-10 w-10 px-0 sm:h-8 sm:w-auto sm:px-3"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? t("following") : t("follow")}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        <BellRing className="size-4" />
      ) : (
        <Bell className="size-4" />
      )}
      <span className="hidden sm:inline">{following ? t("following") : t("follow")}</span>
    </Button>
  );
}
