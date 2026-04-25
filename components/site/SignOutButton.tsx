"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { signOutClient } from "@/lib/firebase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const t = useTranslations("siteUserMenu");
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOutClient();
      router.replace("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleSignOut} disabled={busy} className={className}>
      <LogOut className="size-4" />
      {busy ? t("signingOut") : t("signOut")}
    </Button>
  );
}
