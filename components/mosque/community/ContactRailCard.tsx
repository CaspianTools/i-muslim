import { getTranslations } from "next-intl/server";
import { ExternalLink, Globe, Mail, MessageCircle, Phone } from "lucide-react";
import type { Mosque } from "@/types/mosque";

const linkClass = "inline-flex items-center gap-2 text-foreground hover:text-accent";

/** Left-rail contact card: phone / email / website + social links. */
export async function ContactRailCard({ mosque }: { mosque: Mosque }) {
  const t = await getTranslations("mosques.detail");
  const tActions = await getTranslations("mosques.actions");

  const c = mosque.contact ?? {};
  const s = mosque.social ?? {};
  const hasContact = c.phone || c.email || c.website;
  const hasSocial = s.facebook || s.instagram || s.youtube || s.whatsapp;
  if (!hasContact && !hasSocial) return null;

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
        {s.facebook && (
          <li>
            <a href={s.facebook} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <ExternalLink className="size-4" /> Facebook
            </a>
          </li>
        )}
        {s.instagram && (
          <li>
            <a href={s.instagram} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <ExternalLink className="size-4" /> Instagram
            </a>
          </li>
        )}
        {s.youtube && (
          <li>
            <a href={s.youtube} target="_blank" rel="noopener noreferrer" className={linkClass}>
              <ExternalLink className="size-4" /> YouTube
            </a>
          </li>
        )}
        {s.whatsapp && (
          <li>
            <a
              href={`https://wa.me/${s.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}
