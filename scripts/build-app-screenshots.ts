// Builds the screenshot gallery shown on /apps/quran.
//
// Source is the Play screenshot set in the sibling app repo — 1080x1920 PNGs,
// 200-440 KB each. Eight of them, resized to 720x1280 and re-encoded as WebP,
// come to roughly a tenth of that, which matters because they all sit on one
// page. 720x1280 is exactly two thirds of the source, keeps 9:16, and still
// covers the ~260 CSS px display slot at ~2.7x DPR.
//
// Uses `sharp`, which already ships as a transitive dependency through Next 16
// (no new package needed) — same as scripts/generate-icons.ts.
//
// The output is committed. This script is a convenience for refreshing it, not
// a build step: the site must build with no access to the sibling repo.
//
// Run with: npm run gen:app-shots
// Re-run when a release changes the screenshots — write into a new
// public/apps/quran/shots/<versionCode>/ and bump QURAN_APP.shotSetVersionCode
// in lib/apps/quran.ts, so the old set stays cacheable.

import { existsSync } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { QURAN_APP } from "../lib/apps/quran";

const APP_REPO = path.resolve(process.cwd(), "..", "i-muslim-Quran");
const SRC_DIR = path.join(
  APP_REPO,
  "play-assets",
  "screenshots",
  "release-44",
);
const OUT_DIR = path.resolve(
  process.cwd(),
  "public",
  "apps",
  "quran",
  "shots",
  String(QURAN_APP.shotSetVersionCode),
);

const WIDTH = 720;
const HEIGHT = 1280;
const QUALITY = 78;

// One shot per feature section, so the gallery and the prose reinforce each
// other. Renumbered on output, so display order is lexical and independent of
// however the app repo happens to number its captures.
//
// Portrait only. The landscape captures in the source set are unreliable —
// several are mislabelled portraits and two pairs are byte-identical.
const SHOTS: Array<[source: string, out: string]> = [
  ["01-portrait-surah-list.png", "01-surah-list.webp"],
  ["02-portrait-reader-title-card.png", "02-title-card.webp"],
  ["03-portrait-reader-mushaf.png", "03-mushaf.webp"],
  ["05-portrait-translation-picker.png", "04-translations.webp"],
  ["07-portrait-tajweed.png", "05-tajweed.webp"],
  ["08-portrait-tajweed-legend.png", "06-tajweed-legend.webp"],
  ["06-portrait-ayah-actions.png", "07-ayah-actions.webp"],
  ["04-portrait-reader-dark.png", "08-dark.webp"],
];

const ICON_SRC = path.join(APP_REPO, "play-assets", "store-icon-512.png");
const ICON_OUT = path.resolve(
  process.cwd(),
  "public",
  "apps",
  "quran",
  "icon-512.png",
);

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(
      `Source screenshots not found at ${SRC_DIR}.\n` +
        `This script reads from the sibling i-muslim-Quran checkout; clone it ` +
        `next to this repo, or edit SRC_DIR. The committed output under ` +
        `public/apps/quran/ is what the site actually serves, so the build ` +
        `does not need this.`,
    );
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  let total = 0;
  for (const [source, out] of SHOTS) {
    const from = path.join(SRC_DIR, source);
    if (!existsSync(from)) {
      console.error(`missing source screenshot: ${from}`);
      process.exit(1);
    }
    const to = path.join(OUT_DIR, out);
    await sharp(from)
      .resize(WIDTH, HEIGHT, { fit: "cover" })
      .webp({ quality: QUALITY })
      .toFile(to);
    const { size } = await stat(to);
    total += size;
    console.log(`${out.padEnd(24)} ${(size / 1024).toFixed(0)} KB`);
  }

  await copyFile(ICON_SRC, ICON_OUT);
  console.log(
    `\n${SHOTS.length} screenshots, ${(total / 1024).toFixed(0)} KB total -> ${OUT_DIR}`,
  );
  console.log(`icon -> ${ICON_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
