import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppFeature = {
  /** Stable React key — the message key the page resolved from. */
  key: string;
  Icon: LucideIcon;
  title: string;
  bullets: string[];
};

/**
 * The "What's inside" card grid on an /apps/* page.
 *
 * Takes resolved strings, not a `t` function or a namespace — same contract as
 * AppScreenshotRail, so the page keeps every translation lookup in one place and
 * this stays a dumb server component.
 */
export function AppFeatureGrid({ features }: { features: AppFeature[] }) {
  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2">
      {features.map(({ key, Icon, title, bullets }) => (
        <li
          key={key}
          className="flex h-full flex-col gap-3 rounded-xl border border-border bg-background p-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-selected text-selected-foreground">
              <Icon aria-hidden className="size-5" />
            </span>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          </div>
          <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            {bullets.map((bullet, i) => (
              <li key={i} className="flex gap-2">
                <Check
                  aria-hidden
                  className="mt-1 size-3.5 shrink-0 text-accent"
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
