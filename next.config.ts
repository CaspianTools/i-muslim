import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Optimized remote images (mosque/article uploads, mostly static) were being
    // re-optimized far more often than needed. Hold each variant for 31 days so
    // the Cloud Run image optimizer does the CPU-heavy transform once, not per
    // short window. (AVIF is intentionally not added — its encode is more CPU on
    // the server, and CPU is the cost here; WebP default is the right tradeoff.)
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        // Service worker must never be cached by browsers — otherwise SW
        // updates on subsequent deploys won't be picked up for ~24h. The
        // explicit Content-Type also matters: some hosts default static .js
        // files to `application/octet-stream`, which fails registration.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
