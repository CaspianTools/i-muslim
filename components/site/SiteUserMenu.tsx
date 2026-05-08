"use client";

import { useState } from "react";
import { LogOut, User as UserIcon, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { signInWithGoogle, signOutClient } from "@/lib/firebase/client";
import { initials } from "@/lib/utils";

interface Props {
  session:
    | { uid: string; email: string; name: string | null; picture: string | null }
    | null;
  isAdmin: boolean;
}

export function SiteUserMenu({ session, isAdmin }: Props) {
  const router = useRouter();
  const t = useTranslations("siteUserMenu");
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

  async function handleSignOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOutClient();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignIn}
        disabled={busy}
        aria-label={t("signIn")}
        aria-busy={busy}
        className="rounded-full"
      >
        <Avatar className="size-8">
          <AvatarFallback>
            <UserRound className="size-4" />
          </AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("accountMenu")}
          className="rounded-full"
        >
          <Avatar className="size-8">
            {session.picture && <AvatarImage src={session.picture} alt="" />}
            <AvatarFallback>{initials(session.name ?? session.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel className="flex flex-col normal-case tracking-normal">
          <span className="truncate text-sm font-medium text-foreground">
            {session.name ?? t("fallbackName")}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {session.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserIcon /> {t("profile")}
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <UserIcon /> {t("adminDashboard")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onClick={handleSignOut} disabled={busy}>
          <LogOut /> {busy ? t("signingOut") : t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
