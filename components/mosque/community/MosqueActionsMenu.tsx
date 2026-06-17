"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MosqueManagePanel } from "@/components/mosque/MosqueManagePanel";
import type { Mosque } from "@/types/mosque";

/**
 * Kebab (⋯) menu at the far right of the cover tabs. Holds the manager's
 * "Manage" action, which opens the (controlled) manage dialog. Opening is
 * deferred a tick so the dropdown's focus restore doesn't fight the dialog's
 * focus trap.
 */
export function MosqueActionsMenu({
  mosque,
  analytics,
}: {
  mosque: Mosque;
  analytics?: { views: number; scans: number };
}) {
  const t = useTranslations("mosques.manage");
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("manage")}
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTimeout(() => setOpen(true), 0)}>
            <Settings2 className="size-4" /> {t("manage")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MosqueManagePanel mosque={mosque} analytics={analytics} open={open} onOpenChange={setOpen} />
    </>
  );
}
