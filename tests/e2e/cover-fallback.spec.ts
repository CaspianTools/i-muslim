import { test, expect } from "@playwright/test";
// Import the real helper (no server needed) — a hard regression guard for the
// fix that replaced a bogus fallback pool (which included a Christmas photo)
// with content-verified mosque photos.
import { coverFallbackUrl } from "../../lib/mosques/cover-fallback";

const ALLOWED_HOSTS = ["images.unsplash.com", "upload.wikimedia.org"];

const BANNED_IMAGE_IDS = [
  "1545048702-79362596cdc9",
  "1564769662533-4f00a87b4056",
  "1542816417-0983c9c9ad53",
  "1610116306796-6fea9f4fae38",
  "1591019479261-1a103585c559",
  "1532635248-cdd3d399f56c",
  "1585129777188-94600bc7b4b3",
];

// A wide spread of slugs so every entry in the 8-photo pool gets exercised.
const SLUGS = [
  "friday-mosque",
  "friday-mosque-oguz-azerbaijan",
  "central-masjid",
  "al-noor",
  ...Array.from({ length: 40 }, (_, i) => `mosque-${i}`),
];

test.describe("coverFallbackUrl (no browser needed)", () => {
  test("every slug maps to an allowed mosque-photo host, never a banned image", () => {
    for (const slug of SLUGS) {
      const url = coverFallbackUrl(slug);
      const host = new URL(url).host;
      expect(ALLOWED_HOSTS, `slug "${slug}" → host ${host}`).toContain(host);
      for (const banned of BANNED_IMAGE_IDS) {
        expect(url, `slug "${slug}" must not resolve to banned image ${banned}`).not.toContain(
          banned,
        );
      }
    }
  });

  test("is deterministic per slug", () => {
    for (const slug of SLUGS.slice(0, 8)) {
      expect(coverFallbackUrl(slug)).toBe(coverFallbackUrl(slug));
    }
  });

  test("returns a valid absolute https URL", () => {
    const url = coverFallbackUrl("any-slug");
    expect(url).toMatch(/^https:\/\//);
    expect(() => new URL(url)).not.toThrow();
  });
});
