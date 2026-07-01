import { test, expect } from "./fixtures";

/**
 * Real-browser checks for the mosque directory + a mosque's cover image.
 *
 * Ties into the cover-fallback fix: a mosque without an uploaded cover falls
 * back to a curated mosque photo (see lib/mosques/cover-fallback.ts). Whether a
 * given mosque shows an uploaded cover (Firebase Storage) or the fallback
 * (Unsplash/Wikimedia), the rendered cover must always come from an allowed host
 * and must never be the old non-mosque stock photo.
 */

// Hosts whitelisted for images in next.config.ts.
const ALLOWED_COVER_HOSTS = [
  "images.unsplash.com",
  "upload.wikimedia.org",
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
];

// The Unsplash IDs that used to leak in as fallbacks but are NOT mosques
// (Christmas flat-lay, books, makeup, climbing wall, mural, apartments, Quran
// still-life). None of these may ever be a cover again.
const BANNED_IMAGE_IDS = [
  "1545048702-79362596cdc9", // Christmas / gift-wrap flat-lay (the reported one)
  "1564769662533-4f00a87b4056", // climbing wall
  "1542816417-0983c9c9ad53", // Quran still-life (not a masjid)
  "1610116306796-6fea9f4fae38", // books
  "1591019479261-1a103585c559", // makeup
  "1532635248-cdd3d399f56c", // people at a mural
  "1585129777188-94600bc7b4b3", // apartment blocks
];

/** Unwrap a Next.js `/_next/image?url=<encoded>` src to the upstream URL. */
function originalImageUrl(src: string, baseURL: string): string {
  const abs = new URL(src, baseURL);
  const wrapped = abs.searchParams.get("url");
  return wrapped ? decodeURIComponent(wrapped) : abs.href;
}

test("mosque directory page renders", async ({ page }) => {
  await page.goto("/en/mosques");
  await expect(
    page.getByRole("heading", { name: /Mosque Directory/i }),
  ).toBeVisible();
});

test("a mosque's cover comes from an allowed host and is never a non-mosque stock photo", async ({
  page,
  baseURL,
}) => {
  await page.goto("/en/mosques");

  // Real mosque cards are links to /mosques/<slug> that contain the name <h3>
  // (this excludes sub-route buttons like submit / near-me / following).
  const cards = page.locator('a[href*="/mosques/"]:has(h3)');
  const count = await cards.count();
  test.skip(count === 0, "no mosques in the directory to open");

  await cards.first().click();
  await page.waitForLoadState("domcontentloaded");

  // The cover lives in .mq-cover-fallback (present in the DOM even though it's
  // visually hidden on phones via `hidden sm:block`).
  const cover = page.locator(".mq-cover-fallback img").first();
  await expect(cover).toHaveCount(1);

  const src = await cover.getAttribute("src");
  expect(src, "cover <img> should have a src").toBeTruthy();

  const upstream = originalImageUrl(src!, baseURL ?? "http://localhost:7777");
  const host = new URL(upstream).host;

  expect(
    ALLOWED_COVER_HOSTS,
    `cover host "${host}" (${upstream}) is not an allowed image host`,
  ).toContain(host);

  for (const bannedId of BANNED_IMAGE_IDS) {
    expect(upstream, `cover must not use the non-mosque image ${bannedId}`).not.toContain(
      bannedId,
    );
  }
});
