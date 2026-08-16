import { ArrowUpRight, Smartphone } from "lucide-react";

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
  playUrl,
  locale,
  label,
  ariaLabel,
  variant = "primary",
}: {
  /**
   * Canonical listing URL without `hl`, e.g. QURAN_APP.playUrl. Required on
   * purpose: a default would let a new app page link to the wrong listing with
   * no type error to catch it.
   */
  playUrl: string;
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
      href={`${playUrl}${playUrl.includes("?") ? "&" : "?"}hl=${locale}`}
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
