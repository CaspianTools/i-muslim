import "server-only";
import { QURAN_APP_RELEASES, type AppRelease } from "@/lib/apps/quran";
import { parseStoreListingReleases } from "@/lib/apps/store-listing";

/**
 * Live release data for /apps/quran, pulled from the app's GitHub repo.
 *
 * Every Play release of the Android app updates the RELEASES array in
 * `play-assets/store-listing.html` in CaspianTools/i-muslim-quran (that repo's
 * CLAUDE.md, release workflow step 1), so fetching that one file gives the site
 * the release history with no extra publishing step in the app repo.
 *
 * The fetch is cached for an hour (tag: QURAN_RELEASES_TAG for on-demand
 * revalidation via /api/revalidate/quran-app). The repo is private, so the
 * fetch only runs when QURAN_APP_REPO_TOKEN is set — a fine-grained GitHub PAT
 * with read-only Contents access to that one repo. Without the token, or on
 * any fetch/parse failure, the site falls back to the committed snapshot in
 * lib/apps/quran.ts, so a GitHub outage (or an unset secret) can never break
 * the build or the page.
 */

const STORE_LISTING_URL =
  "https://api.github.com/repos/CaspianTools/i-muslim-quran/contents/play-assets/store-listing.html?ref=main";

export const QURAN_RELEASES_TAG = "quran-app-releases";

async function fetchLiveReleases(): Promise<AppRelease[] | null> {
  const token = process.env.QURAN_APP_REPO_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(STORE_LISTING_URL, {
      headers: {
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 3600, tags: [QURAN_RELEASES_TAG] },
    });
    if (!res.ok) {
      console.error(
        `[apps/quran] GitHub store-listing fetch failed: ${res.status} ${res.statusText}`,
      );
      return null;
    }
    const releases = parseStoreListingReleases(await res.text())
      // Never-shipped versionCodes are build-log noise, not public history —
      // same policy as the committed snapshot.
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
    console.error("[apps/quran] GitHub store-listing fetch/parse failed:", err);
    return null;
  }
}

/**
 * All shipped releases, newest first: the live GitHub data overlaid on the
 * committed snapshot (live wins per versionCode), or the snapshot alone when
 * live data is unavailable.
 */
export async function getQuranReleases(): Promise<readonly AppRelease[]> {
  const live = await fetchLiveReleases();
  if (!live) return QURAN_APP_RELEASES;

  const byCode = new Map<number, AppRelease>();
  for (const r of QURAN_APP_RELEASES) byCode.set(r.versionCode, r);
  for (const r of live) byCode.set(r.versionCode, r);
  return [...byCode.values()].sort((a, b) => b.versionCode - a.versionCode);
}

/** The newest shipped release — drives the hero line, JSON-LD and sitemap. */
export async function getQuranLatestRelease(): Promise<AppRelease> {
  return (await getQuranReleases())[0];
}
