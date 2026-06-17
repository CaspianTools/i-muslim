/**
 * Royalty-free fallback cover photos (Unsplash — `images.unsplash.com` is an
 * allowed remote host in next.config). Picked deterministically per masjid so a
 * mosque without an uploaded cover still gets a real, stable photo rather than a
 * bare gradient. All IDs verified to resolve.
 */
const FALLBACK_COVER_IDS = [
  "1564769662533-4f00a87b4056",
  "1519817650390-64a93db51149",
  "1542816417-0983c9c9ad53",
  "1610116306796-6fea9f4fae38",
  "1545048702-79362596cdc9",
  "1591019479261-1a103585c559",
  "1532635248-cdd3d399f56c",
  "1585129777188-94600bc7b4b3",
];

function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function coverFallbackUrl(slug: string): string {
  const id = FALLBACK_COVER_IDS[hashSlug(slug) % FALLBACK_COVER_IDS.length];
  return `https://images.unsplash.com/photo-${id}?w=1600&q=80&auto=format&fit=crop`;
}
