"use client";

import { BookOpen, BookOpenCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReadingMode, type ReadingScope } from "@/lib/reading/reading-mode";
import { cn } from "@/lib/utils";

/**
 * Header icon that flips the page in or out of reading mode for its scope.
 * The same component renders in both states — the icon and aria-pressed
 * change so screen readers know whether reading mode is engaged.
 */
export function ReadingModeToggle({
  scope,
  className,
}: {
  scope: ReadingScope;
  className?: string;
}) {
  const [active, setActive] = useReadingMode(scope);
  const t = useTranslations("readingMode");
  const label = active ? t("exit") : t("enter");
  const Icon = active ? BookOpenCheck : BookOpen;
  return (
    <button
      type="button"
      onClick={() => setActive(!active)}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border ui-selected-chip-idle transition-colors",
        active && "ui-selected-chip border-transparent",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
