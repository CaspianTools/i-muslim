"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, type SidebarBadges } from "./Sidebar";

export function MobileSidebarDrawer({ badges }: { badges?: SidebarBadges }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("header");
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("openMenu")}
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetTitle className="sr-only">{t("navigation")}</SheetTitle>
          <Sidebar variant="drawer" badges={badges} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
