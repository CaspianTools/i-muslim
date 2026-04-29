"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import type { LangCode } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { QuranSidebar } from "./QuranSidebar";

interface QuranMobileDrawerProps {
  availableLangs: readonly LangCode[];
}

export function QuranMobileDrawer({ availableLangs }: QuranMobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("quranSidebar");
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("menu")}
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <SlidersHorizontal className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetTitle className="sr-only">{t("title")}</SheetTitle>
          <QuranSidebar
            variant="drawer"
            availableLangs={availableLangs}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
