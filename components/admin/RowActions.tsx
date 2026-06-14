"use client";

import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  /** Accessible label for the kebab trigger (e.g. the localized "Actions"). */
  label: string;
  /** `DropdownMenuItem` / `DropdownMenuSeparator` children. */
  children: React.ReactNode;
}

/**
 * Standard per-row actions kebab for admin list tables: a `⋯` (horizontal
 * three-dots) trigger that opens an end-aligned dropdown of actions. Mirrors
 * the inline pattern already used by Users/Mosques/Events so every admin row
 * looks alike. Stops click propagation so it works inside clickable rows.
 */
export function RowActions({ label, children }: Props) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={label}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{children}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
