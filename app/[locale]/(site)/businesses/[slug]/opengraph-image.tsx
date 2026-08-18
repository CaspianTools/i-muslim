import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { getBySlug } from "@/lib/businesses/public";

export const runtime = "nodejs";
// Static by necessity: Next evaluates `alt` at module load, so it cannot be
// localised without generateImageMetadata. The image content below is localised.
export const alt = "Halal business listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  // Next 16 passes params as a Promise. This file used to destructure it
  // synchronously, so `slug` was undefined and every card rendered the generic
  // fallback instead of the business.
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const [business, t, tHalal] = await Promise.all([
    getBySlug(slug),
    getTranslations({ locale, namespace: "businesses" }),
    getTranslations({ locale, namespace: "businesses.halal" }),
  ]);

  const title = business?.name ?? t("ogFallbackTitle");
  const description = business?.description.en ?? t("ogFallbackDescription");
  const city = business?.address.city;
  const halalLabel =
    business?.halal.status === "certified"
      ? tHalal("certified")
      : business?.halal.status === "self_declared"
        ? tHalal("self_declared")
        : business?.halal.status === "muslim_owned"
          ? tHalal("muslim_owned")
          : t("ogHalalFallback");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0c4a3f 0%, #134e4a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, opacity: 0.85 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 8,
              background: "white",
              color: "#0c4a3f",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            ۞
          </span>
          i-muslim · {t("ogBrandLine")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 28, opacity: 0.9, maxWidth: 1000, lineHeight: 1.3 }}>
            {description.length > 160 ? description.slice(0, 157) + "…" : description}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 22 }}>
          {/* Omitted when the business has no city. It used to fall back to
              "London", which put a real, wrong city on the share card. */}
          {city && (
            <span
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              {city}
            </span>
          )}
          <span
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            {halalLabel}
          </span>
        </div>
      </div>
    ),
    size,
  );
}
