import "server-only";
import { QURAN_APP_RELEASES } from "@/lib/apps/quran";
import { makeReleaseLoader } from "@/lib/apps/releases";

/**
 * Live release data for /apps/quran — see lib/apps/releases.ts for how the
 * fetch, the `shipped` filter, the snapshot merge and the failure policy work.
 *
 * The repo is private, so the fetch only runs when QURAN_APP_REPO_TOKEN is set
 * (a fine-grained GitHub PAT with read-only Contents access to that one repo;
 * see apphosting.yaml). Without it the site falls back to the committed
 * snapshot in lib/apps/quran.ts. POST /api/revalidate/quran-app refreshes the
 * hour-long cache instantly.
 */

export const QURAN_RELEASES_TAG = "quran-app-releases";

const loader = makeReleaseLoader({
  id: "apps/quran",
  repo: "CaspianTools/i-muslim-quran",
  tag: QURAN_RELEASES_TAG,
  token: () => process.env.QURAN_APP_REPO_TOKEN,
  snapshot: QURAN_APP_RELEASES,
});

export const getQuranReleases = loader.getReleases;
export const getQuranLatestRelease = loader.getLatestRelease;
