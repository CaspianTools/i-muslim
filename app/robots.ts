import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/mosques/constants";

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // `*/admin/` also covers the locale-prefixed admin paths (/en/admin/,
      // /ar/admin/, …) that a bare `/admin/` rule would miss.
      disallow: ["/admin/", "*/admin/", "/api/"],
    },
    sitemap: `${site}/sitemap.xml`,
    host: site.replace(/^https?:\/\//, ""),
  };
}
