import { getTranslations } from "next-intl/server";
import { Globe, Link2, Mail, Phone } from "lucide-react";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/types/mosque";
import { SOCIAL_LABELS, socialHref } from "@/lib/mosques/social";
import type { Mosque } from "@/types/mosque";

const linkClass = "inline-flex items-center gap-2 text-foreground hover:text-accent";

/** Left-rail contact card: phone / email / website + social links. */
export async function ContactRailCard({ mosque }: { mosque: Mosque }) {
  const t = await getTranslations("mosques.detail");
  const tActions = await getTranslations("mosques.actions");

  const c = mosque.contact ?? {};
  const s = mosque.social ?? {};
  const socials = SOCIAL_PLATFORMS.filter((p) => s[p]) as SocialPlatform[];
  const hasContact = c.phone || c.email || c.website;
  if (!hasContact && socials.length === 0) return null;

  return (
    <div className="mq-card mq-card-pad">
      <div className="mq-rail-title">{t("contact")}</div>
      <ul className="space-y-2 text-sm">
        {c.phone && (
          <li>
            <a href={`tel:${c.phone}`} className={linkClass}>
              <Phone className="size-4" /> {c.phone}
            </a>
          </li>
        )}
        {c.email && (
          <li>
            <a href={`mailto:${c.email}`} className={linkClass}>
              <Mail className="size-4" /> {tActions("emailMosque")}
            </a>
          </li>
        )}
        {c.website && (
          <li>
            <a href={c.website} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <Globe className="size-4" /> {tActions("visitWebsite")}
            </a>
          </li>
        )}
        {socials.map((p) => (
          <li key={p}>
            <a
              href={socialHref(p, s[p]!)}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <Link2 className="size-4" /> {SOCIAL_LABELS[p]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
