"use client";

import { MoreHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  /** Inline-rendered children at `md+`. Typically icon-only versions. */
  desktop: React.ReactNode;
  /** Children rendered inside a Popover at `<md`. Typically full-label versions. */
  mobile: React.ReactNode;
  /** Aria label for the mobile overflow trigger. */
  triggerLabel: string;
}

/**
 * Action-row wrapper used in `AyahCard` (and any future card with a 3+ icon
 * row). At `md+` the children render inline as small icon pills. At `<md`
 * they collapse into a single `⋯` trigger that opens a Popover with the same
 * actions, each rendered as a tappable row.
 *
 * Why two child slots instead of one: each call site needs different prop
 * variants — e.g., `<FavoriteButton iconOnly>` looks right inline but should
 * show its label inside the popover. Passing the same children to both
 * branches and toggling visuals via CSS would either lose the label or
 * waste space in the inline row.
 *
 * Both subtrees mount simultaneously, but the visible one is gated by
 * `hidden md:flex` / `md:hidden` so only one is interactive. The triggers
 * share React context (FavoritesContext, NoteEditor's provider) so any
 * state stays in sync between the two instances.
 */
export function AyahActionsRow({ desktop, mobile, triggerLabel }: Props) {
  return (
    <>
      <div className="hidden md:flex items-center gap-2">{desktop}</div>
      <Popover>
        <PopoverTrigger
          aria-label={triggerLabel}
          className="md:hidden touch-target inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <MoreHorizontal className="size-4" />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto min-w-[10rem] p-2 flex flex-col items-stretch gap-2"
        >
          {mobile}
        </PopoverContent>
      </Popover>
    </>
  );
}
