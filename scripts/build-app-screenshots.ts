// Builds the screenshot galleries shown on /apps/quran and /apps/prayer.
//
// Source is the Play screenshot set in each sibling app repo — 1080x1920 PNGs,
// 200-440 KB each. Eight of them, resized to 720x1280 and re-encoded as WebP,
// come to roughly a tenth of that, which matters because they all sit on one
// page. 720x1280 is exactly two thirds of the source, keeps 9:16, and still
// covers the ~260 CSS px display slot at ~2.7x DPR.
//
// Uses `sharp`, which already ships as a transitive dependency through Next 16
// (no new package needed) — same as scripts/generate-icons.ts.
//
// The output is committed. This script is a convenience for refreshing it, not
// a build step: the site must build with no access to the sibling repos.
//
// Run with:
//   npm run gen:app-shots              every app whose checkout is present
//   npm run gen:app-shots -- --app prayer
//
// Re-run when a release changes the screenshots — write into a new
// public/apps/<app>/shots/<versionCode>/ and bump that app's
// shotSetVersionCode in lib/apps/<app>.ts, so the old set stays cacheable.

import { existsSync } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { QURAN_APP } from "../lib/apps/quran";
import { PRAYER_APP } from "../lib/apps/prayer";

const WIDTH = 720;
const HEIGHT = 1280;
const QUALITY = 78;

type ShotJob = {
  slug: string;
  /** Exact sibling directory name — note the capital Q on the Quran repo. */
  repoDir: string;
  srcDir: (repo: string) => string;
  iconSrc: (repo: string) => string;
  /** Output goes to public/apps/<slug>/shots/<versionCode>/. */
  versionCode: number;
  /** One shot per feature section, so gallery and prose reinforce each other.
   *  Renumbered on output, so display order is lexical and independent of
   *  however the app repo happens to number its captures. */
  shots: Array<[source: string, out: string]>;
};

const APPS: Record<string, ShotJob> = {
  quran: {
    slug: "quran",
    repoDir: "i-muslim-Quran",
    // Derived from the shot set, not hardcoded: the app repo names each release
    // folder after its versionCode.
    srcDir: (repo) =>
      path.join(
        repo,
        "play-assets",
        "screenshots",
        `release-${QURAN_APP.shotSetVersionCode}`,
      ),
    iconSrc: (repo) => path.join(repo, "play-assets", "store-icon-512.png"),
    versionCode: QURAN_APP.shotSetVersionCode,
    // Portrait only. The landscape captures in the source set are unreliable —
    // several are mislabelled portraits and two pairs are byte-identical.
    shots: [
      ["01-portrait-surah-list.png", "01-surah-list.webp"],
      ["02-portrait-reader-title-card.png", "02-title-card.webp"],
      ["03-portrait-reader-mushaf.png", "03-mushaf.webp"],
      ["05-portrait-translation-picker.png", "04-translations.webp"],
      ["07-portrait-tajweed.png", "05-tajweed.webp"],
      ["08-portrait-tajweed-legend.png", "06-tajweed-legend.webp"],
      ["06-portrait-ayah-actions.png", "07-ayah-actions.webp"],
      ["04-portrait-reader-dark.png", "08-dark.webp"],
    ],
  },
  prayer: {
    slug: "prayer",
    repoDir: "i-muslim-prayer",
    // The prayer repo keeps one flat, current set under graphics/ — its
    // screenshots/release-<n>/ folders hold only incidental extra captures.
    srcDir: (repo) => path.join(repo, "play-assets", "graphics", "screenshots"),
    iconSrc: (repo) =>
      path.join(repo, "play-assets", "graphics", "ic_store_512.png"),
    versionCode: PRAYER_APP.shotSetVersionCode,
    shots: [
      ["01_today.png", "01-today.webp"],
      ["02_widget.png", "02-widget.webp"],
      ["03_adhan.png", "03-adhan.webp"],
      ["04_silence.png", "04-silence.webp"],
      ["05_methods.png", "05-methods.webp"],
      ["06_location.png", "06-location.webp"],
      ["07_settings.png", "07-settings.webp"],
      ["08_permissions.png", "08-permissions.webp"],
    ],
  },
};

async function build(job: ShotJob) {
  const repo = path.resolve(process.cwd(), "..", job.repoDir);
  const srcDir = job.srcDir(repo);
  const outDir = path.resolve(
    process.cwd(),
    "public",
    "apps",
    job.slug,
    "shots",
    String(job.versionCode),
  );
  const iconOut = path.resolve(
    process.cwd(),
    "public",
    "apps",
    job.slug,
    "icon-512.png",
  );

  await mkdir(outDir, { recursive: true });

  let total = 0;
  for (const [source, out] of job.shots) {
    const from = path.join(srcDir, source);
    if (!existsSync(from)) {
      console.error(`missing source screenshot: ${from}`);
      process.exit(1);
    }
    const to = path.join(outDir, out);
    await sharp(from)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .webp({ quality: QUALITY })
      .toFile(to);
    const { size } = await stat(to);
    total += size;
    console.log(`${job.slug}/${out.padEnd(24)} ${(size / 1024).toFixed(0)} KB`);
  }

  await copyFile(job.iconSrc(repo), iconOut);
  console.log(
    `\n${job.shots.length} screenshots, ${(total / 1024).toFixed(0)} KB total -> ${outDir}`,
  );
  console.log(`icon -> ${iconOut}\n`);
}

function missingSourceMessage(job: ShotJob, srcDir: string) {
  return (
    `Source screenshots not found at ${srcDir}.\n` +
    `This script reads from the sibling ${job.repoDir} checkout; clone it ` +
    `next to this repo. The committed output under public/apps/${job.slug}/ ` +
    `is what the site actually serves, so the build does not need this.`
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = argv.indexOf("--app");
  const want = flag === -1 ? undefined : argv[flag + 1];

  if (want !== undefined && !(want in APPS)) {
    console.error(
      `Unknown app "${want}". Known apps: ${Object.keys(APPS).join(", ")}.\n` +
        `Usage: npm run gen:app-shots [-- --app <${Object.keys(APPS).join("|")}>]`,
    );
    process.exit(1);
  }

  const jobs = want ? [APPS[want]] : Object.values(APPS);

  for (const job of jobs) {
    const srcDir = job.srcDir(path.resolve(process.cwd(), "..", job.repoDir));
    if (!existsSync(srcDir)) {
      // An explicit --app means the caller expected that repo to be there.
      // A bare run should not go red just because only one sibling is cloned.
      if (want) {
        console.error(missingSourceMessage(job, srcDir));
        process.exit(1);
      }
      console.warn(`skipping ${job.slug}: ${srcDir} not found`);
      continue;
    }
    await build(job);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
