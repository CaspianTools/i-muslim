/**
 * Salatuk (Namaz) Prayer Times — the data behind /apps/prayer.
 *
 * RELEASES below is a committed FALLBACK SNAPSHOT, not the live source. At
 * request time the site fetches the release history straight from the app
 * repo's play-assets/store-listing.html (lib/apps/prayer-releases.ts, cached
 * one hour), so a new Play release appears on /apps/prayer on its own — no
 * hand edit here. This snapshot renders only when that fetch can't
 * (PRAYER_APP_REPO_TOKEN unset, GitHub outage, parse failure), so it may lag;
 * refresh it now and then by pasting in the newest entries. Two things are
 * still manual per release:
 *
 *   1. Screenshots: if they changed, re-run `npm run gen:app-shots -- --app
 *      prayer` into public/apps/prayer/shots/<versionCode>/ and bump
 *      shotSetVersionCode.
 *   2. Privacy policy: if the release changes what the app does with data,
 *      update legal.privacy.prayerApp in all four locales (see CLAUDE.md). That
 *      section is the URL submitted to Play, which Google cross-checks against
 *      the Data safety form.
 *
 * The release data drives /apps/prayer, /apps/prayer/changelog, the JSON-LD
 * softwareVersion / dateModified / releaseNotes, and the sitemap lastModified.
 *
 * Release notes stay English on purpose — only the newest release is translated
 * on Play, and moving historical notes into messages/*.json would poison the
 * `check:locales` signal with permanently-untranslated keys.
 *
 * ONLY SHIPPED RELEASES BELONG HERE. The app went live at versionCode 14;
 * everything below it (1.7.0/code 13 and the whole 1.0–1.6 run, codes 1–12) was
 * built in the app repo but never uploaded, and is marked `shipped:0` there. The
 * live fetch drops those entries — but the snapshot is merged in *unfiltered*,
 * so an entry pasted here "for completeness" would render forever, even once
 * live data is available. This is the public history, not the build log.
 */

import type { AppRelease } from "@/lib/apps/types";

export const PRAYER_APP = {
  packageId: "com.imuslim.prayer",
  playUrl: "https://play.google.com/store/apps/details?id=com.imuslim.prayer",
  /** Which release the screenshots under public/apps/prayer/shots/<n>/ came from. */
  shotSetVersionCode: 15,
} as const;

/** Newest first. Prepend new releases at the top. */
const RELEASES: AppRelease[] = [
  {
    version: "1.9.0",
    versionCode: 15,
    date: "2026-08-14",
    summary: "A new app icon",
    note: "Salatuk has a new icon. The mosque on your home screen now matches the one on the Play listing, drawn in the i-muslim green — so Salatuk and the i-muslim Quran app finally look like a family. It is redrawn from scratch rather than resized, so it stays whole whatever shape your launcher masks icons into, and it now follows your wallpaper as a themed icon on Android 13 and later. The icon on prayer notifications was redrawn to match.",
  },
  {
    version: "1.8.0",
    versionCode: 14,
    date: "2026-08-12",
    summary:
      "A month and year prayer calendar you can export, and a separate iqamah time per prayer",
    note: "New: a prayer calendar. See a whole month's times in one table, or the whole year at a glance, and export any month or year as a standard .ics file to import into Google Calendar, Apple Calendar or Outlook — the file is built on your device, nothing is uploaded. Also new: each prayer now has its own gap between the adhan and the iqamah, instead of one shared for all five. Still fully offline, no ads, no tracking.",
  },
];

/** Sorted defensively, so a hand-added entry in the wrong place still renders right. */
export const PRAYER_APP_RELEASES: readonly AppRelease[] = [...RELEASES].sort(
  (a, b) => b.versionCode - a.versionCode,
);
