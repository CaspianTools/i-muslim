// Pure constants + types for typography selection. Lives outside the
// server-only data layer so client components (e.g. TypographyForm) can
// import the option lists and types directly without crossing the
// server/client boundary.

export const BODY_FONT_OPTIONS = ["inter", "plex-sans", "roboto"] as const;
export type BodyFont = (typeof BODY_FONT_OPTIONS)[number];
export const DEFAULT_BODY_FONT: BodyFont = "inter";

export const ARABIC_FONT_OPTIONS = ["amiri", "scheherazade", "noto-naskh"] as const;
export type ArabicFont = (typeof ARABIC_FONT_OPTIONS)[number];
export const DEFAULT_ARABIC_FONT: ArabicFont = "amiri";
