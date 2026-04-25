"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { signInWithGoogle } from "@/lib/firebase/client";

interface Props {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SignInButton({ className, size = "md" }: Props) {
  const router = useRouter();
  const tAuth = useTranslations("auth");
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    try {
      const user = await signInWithGoogle();
      const idToken = await user.getIdToken(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? tAuth("signInFailed"));
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tAuth("signInFailed");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={busy}
      size={size}
      className={className}
      aria-busy={busy}
    >
      {busy ? (
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <LogIn className="size-4" />
      )}
      {tAuth("continueWithGoogle")}
    </Button>
  );
}
