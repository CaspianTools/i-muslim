import { ArrowUpRight, Smartphone } from "lucide-react";
import { QURAN_APP } from "@/lib/apps/quran";

/**
 * Link to the app's Google Play listing.
 *
 * Deliberately a first-party button and not a Play badge lookalike: Google's
 * badge guidelines require the official artwork used unmodified, and expressly
 * prohibit recreating or restyling it. Plain-text linking to a store listing is
 * unrestricted, so a styled text button is the compliant option.
 *
 * TODO: swap in the official badge from
 * https://play.google.com/intl/en_us/badges/ when the asset can be downloaded.
 * Google publishes localised badges covering all four bundled locales — key one
 * off `locale`, render it with <Image> at a minimum height of 40px, unmodified
 * and with the mandated clear space. Nothing outside this file needs to change.
 */
export function PlayStoreButton({
  locale,
  label,
  ariaLabel,
  variant = "primary",
}: {
  locale: string;
  label: string;
  ariaLabel: string;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      : "inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent";

  return (
    <a
      // `hl` makes Play open its own listing in the visitor's language — all
      // four bundled locales have a translated Play listing.
      href={`${QURAN_APP.playUrl}&hl=${locale}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={className}
    >
      <Smartphone aria-hidden className="size-4" />
      {label}
      <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
    </a>
  );
}
