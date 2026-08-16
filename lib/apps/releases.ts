import "server-only";
import type { AppRelease } from "@/lib/apps/types";
import { parseStoreListingReleases } from "@/lib/apps/store-listing";

/**
 * Live release data for an /apps/* page, pulled from the app's GitHub repo.
 *
 * Every Play release of an i-muslim Android app updates the RELEASES array in
 * that repo's `play-assets/store-listing.html` (see each app repo's CLAUDE.md,
 * release workflow step 1), so fetching that one file gives the site the release
 * history with no extra publishing step in the app repo.
 *
 * Four decisions live here, and they are the reason this is shared rather than
 * copied per app:
 *
 *   1. `shipped:0` entries are dropped — that's the build log, not the public
 *      history.
 *   2. Live data is overlaid on the committed snapshot per versionCode, live
 *      winning, so a stale snapshot can only ever be additive.
 *   3. Live data that parses to nothing is treated as no data at all.
 *   4. Any fetch or parse failure falls back to the snapshot rather than
 *      throwing, so a GitHub outage (or an unset token) can never break the
 *      build or the page.
 *
 * The app repos are private, so each fetch only runs when its token is set — a
 * fine-grained GitHub PAT with read-only Contents access to that one repo.
 */

export type ReleaseLoader = {
  /** The cache tag, for the matching /api/revalidate/<app> route. */
  tag: string;
  /** All shipped releases, newest first. Never empty, never throws. */
  getReleases: () => Promise<readonly AppRelease[]>;
  /** The newest shipped release — drives the hero line, JSON-LD and sitemap. */
  getLatestRelease: () => Promise<AppRelease>;
};

export function makeReleaseLoader(cfg: {
  /** Log prefix, e.g. "apps/quran". */
  id: string;
  /** "owner/name", e.g. "CaspianTools/i-muslim-quran". */
  repo: string;
  /** Cache tag. MUST be unique per app, or one app's refresh clears another's. */
  tag: string;
  /**
   * Read the PAT. A thunk, not a value: keeps the read lazy (module load order
   * stops mattering) while leaving `process.env.X` statically greppable.
   */
  token: () => string | undefined;
  /** Committed fallback. Already newest-first and already shipped-only. */
  snapshot: readonly AppRelease[];
  path?: string;
  ref?: string;
}): ReleaseLoader {
  const url =
    `https://api.github.com/repos/${cfg.repo}/contents/` +
    `${cfg.path ?? "play-assets/store-listing.html"}?ref=${cfg.ref ?? "main"}`;

  async function fetchLive(): Promise<AppRelease[] | null> {
    const token = cfg.token();
    if (!token) return null;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.raw+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 3600, tags: [cfg.tag] },
      });
      if (!res.ok) {
        console.error(
          `[${cfg.id}] GitHub store-listing fetch failed: ${res.status} ${res.statusText}`,
        );
        return null;
      }
      const releases = parseStoreListingReleases(await res.text())
        // Never-shipped versionCodes are build-log noise, not public history —
        // same policy as the committed snapshots.
        .filter((r) => r.shipped)
        .map<AppRelease>((r) => ({
          version: r.version,
          versionCode: r.versionCode,
          date: r.date,
          // Old snapshot entries carried this exact line for note-less releases.
          summary: r.summary ?? "No release note was recorded for this version",
          note: r.note,
        }));
      return releases.length > 0 ? releases : null;
    } catch (err) {
      console.error(`[${cfg.id}] GitHub store-listing fetch/parse failed:`, err);
      return null;
    }
  }

  const getReleases = async (): Promise<readonly AppRelease[]> => {
    const live = await fetchLive();
    if (!live) return cfg.snapshot;

    const byCode = new Map<number, AppRelease>();
    for (const r of cfg.snapshot) byCode.set(r.versionCode, r);
    for (const r of live) byCode.set(r.versionCode, r);
    const merged = [...byCode.values()].sort((a, b) => b.versionCode - a.versionCode);
    // Callers read [0] unguarded, so never hand back an empty list.
    return merged.length > 0 ? merged : cfg.snapshot;
  };

  return {
    tag: cfg.tag,
    getReleases,
    getLatestRelease: async () => (await getReleases())[0],
  };
}
