import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  /**
   * Whether the section is expanded on first paint. Default `true` keeps
   * legacy call sites unchanged (MatrimonialEnableForm). ProfileForm passes
   * `false` for sections after the first so a 24-field form doesn't
   * present as a wall of inputs — only Identity is open by default.
   */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Profile form section. Renders as a native `<details>` element so the
 * collapsed/expanded state lives in the DOM and survives browser back/forward
 * navigation without React state. Collapsed sections still keep their fields
 * mounted (form state preserved across opens), they just hide visually.
 */
export function Section({
  title,
  description,
  defaultOpen = true,
  children,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-border bg-card"
    >
      <summary
        // `cursor-pointer` because the default summary cursor is a text caret;
        // `list-none` + `[&::-webkit-details-marker]:hidden` hide the native
        // disclosure triangle since we render our own ChevronDown that flips.
        className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 select-none list-none [&::-webkit-details-marker]:hidden"
      >
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">{children}</div>
    </details>
  );
}
