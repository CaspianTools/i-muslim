import "server-only";
import { PRAYER_APP_RELEASES } from "@/lib/apps/prayer";
import { makeReleaseLoader } from "@/lib/apps/releases";

/**
 * Live release data for /apps/prayer — see lib/apps/releases.ts for how the
 * fetch, the `shipped` filter, the snapshot merge and the failure policy work.
 *
 * The repo is private, so the fetch only runs when PRAYER_APP_REPO_TOKEN is set
 * (a fine-grained GitHub PAT with read-only Contents access to that one repo;
 * see apphosting.yaml). Without it the site falls back to the committed
 * snapshot in lib/apps/prayer.ts. POST /api/revalidate/prayer-app refreshes the
 * hour-long cache instantly.
 */

export const PRAYER_RELEASES_TAG = "prayer-app-releases";

const loader = makeReleaseLoader({
  id: "apps/prayer",
  repo: "CaspianTools/i-muslim-prayer",
  tag: PRAYER_RELEASES_TAG,
  token: () => process.env.PRAYER_APP_REPO_TOKEN,
  snapshot: PRAYER_APP_RELEASES,
});

export const getPrayerReleases = loader.getReleases;
export const getPrayerLatestRelease = loader.getLatestRelease;
