import type { SocialPlatform } from "@/types/mosque";

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  website: "Website",
};

/** Build a real href from a stored social value (a full URL or a bare handle). */
export function socialHref(platform: SocialPlatform, value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    case "youtube":
      return `https://youtube.com/@${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "telegram":
      return `https://t.me/${handle}`;
    case "whatsapp":
      return `https://wa.me/${handle.replace(/[^0-9]/g, "")}`;
    case "website":
      return `https://${v.replace(/^https?:\/\//i, "")}`;
  }
}
