"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Keyboard, LogOut, ScrollText, Settings, User as UserIcon } from "lucide-react";
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
import { signOutClient } from "@/lib/firebase/client";
import { initials } from "@/lib/utils";

interface UserMenuProps {
  name: string | null;
  email: string;
  picture: string | null;
}

export function UserMenu({ name, email, picture }: UserMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const t = useTranslations("userMenu");
  const tHeader = useTranslations("header");

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await signOutClient();
      router.push("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tHeader("accountMenu")} className="rounded-full">
          <Avatar className="size-8">
            {picture && <AvatarImage src={picture} alt="" />}
            <AvatarFallback>{initials(name ?? email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        <DropdownMenuLabel className="flex flex-col normal-case tracking-normal">
          <span className="text-sm font-medium text-foreground truncate">{name ?? t("fallbackName")}</span>
          <span className="text-xs font-normal text-muted-foreground truncate">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/settings"><UserIcon /> {t("profile")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/settings"><Settings /> {t("accountSettings")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/activity"><ScrollText /> {t("activityLog")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Keyboard /> {t("keyboardShortcuts")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onClick={handleSignOut} disabled={signingOut}>
          <LogOut /> {signingOut ? t("signingOut") : t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
