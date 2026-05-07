import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Optional icon — typically a lucide-react component sized 5-6. */
  icon?: ReactNode;
  /** Main message — should read as a complete sentence, not a label. */
  title: string;
  /** Optional sub-line explaining context or what to do next. */
  description?: string;
  /**
   * Optional follow-up affordances. Most useful when an empty state has a
   * concrete next action ("Submit a mosque") or interaction prompts that turn
   * dead-end empty space into product space ("What stood out?", "A question
   * I have"). Pass <button>s, <Link>s, or chip-shaped pills.
   */
  actions?: ReactNode;
  className?: string;
}

/**
 * Generic empty state. Replaces the older one-line `<div className="…-empty">`
 * recipes scattered across CommentList, favorites, etc. with a single shape:
 * dashed border, centered, optional icon + title + description + action row.
 *
 * The visual is deliberately understated — empty states should invite an
 * action without competing with the page's actual content for attention.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-md border border-dashed border-border bg-card/50 p-6 text-center",
        className,
      )}
    >
      {icon && (
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {actions && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
