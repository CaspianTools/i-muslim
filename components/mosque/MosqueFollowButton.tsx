"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleMosqueFollow } from "@/app/[locale]/(site)/mosques/follow-actions";

export function MosqueFollowButton({
  slug,
  initialFollowing,
  initialCount,
  signedIn,
}: {
  slug: string;
  initialFollowing: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const t = useTranslations("mosques.follow");
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
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
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await toggleMosqueFollow(slug);
      if (!res.ok) {
        setFollowing(!next);
        setCount((c) => c + (next ? -1 : 1));
        toast.error(t("failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={following ? "secondary" : "primary"}
      size="sm"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        <BellRing className="size-4" />
      ) : (
        <Bell className="size-4" />
      )}
      {following ? t("following") : t("follow")}
      {count > 0 ? ` · ${count}` : ""}
    </Button>
  );
}
