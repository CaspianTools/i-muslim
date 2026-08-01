import Image from "next/image";

export type AppScreenshot = {
  /** Absolute path under /public, e.g. "/apps/quran/shots/44/01-surah-list.webp". */
  src: string;
  /** Already-translated caption. */
  caption: string;
  /** Already-translated alt text, which should include the caption. */
  alt: string;
};

/**
 * Horizontal, snapping gallery of phone screenshots.
 *
 * A rail rather than a grid: eight 9:16 portraits in a grid would run to two
 * rows and ~750px of vertical screenshot before the reader reaches any prose.
 * The rail keeps the whole set to one band, and reads as "app store", which is
 * the genre.
 *
 * Server component — CSS scroll snapping, no JS.
 *
 * RTL needs no overrides here: `flex` reverses under `dir="rtl"` and browsers
 * start horizontal scroll at the right edge on their own. The screenshots
 * themselves must never be mirrored — they are pictures of a UI.
 */
export function AppScreenshotRail({ shots }: { shots: AppScreenshot[] }) {
  return (
    <div className="thin-scrollbar -mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-3">
      <ul className="flex w-max gap-4">
        {shots.map((shot) => (
          <li key={shot.src} className="w-56 shrink-0 snap-start sm:w-64">
            <figure>
              {/* `unoptimized`: these are already at their display size in their
                  final format, so /_next/image would burn server CPU (the cost
                  centre called out in next.config.ts) for no gain. */}
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={720}
                  height={1280}
                  unoptimized
                  className="block h-auto w-full"
                />
              </div>
              <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {shot.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
