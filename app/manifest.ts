import type { MetadataRoute } from "next";

/**
 * Web App Manifest. Next 16 generates `/manifest.webmanifest` from this file
 * (App Router metadata convention) — no Webpack plugin required, works under
 * Turbopack which is the framework default.
 *
 * For the install prompt to actually fire, browsers (Chromium-based) require
 * 192×192 and 512×512 PNG icons. The SVG / brand glyph paths below are the
 * scaffolding — the PNGs are tracked as a follow-up: place them under
 * `public/icons/` as `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`.
 * Once present they will be picked up automatically without code changes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "i-muslim",
    short_name: "i-muslim",
    description:
      "Read the Quran and Sunnah, find prayer times, mosques, and halal life — all in one place.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Brand greens from globals.css — `--selected-foreground` is the brand
    // accent in light mode (`#7ba143`); background is the page surface.
    background_color: "#fafaf9",
    theme_color: "#7ba143",
    categories: ["lifestyle", "education", "books"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
