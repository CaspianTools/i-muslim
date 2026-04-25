import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";

interface Props {
  lat: number;
  lng: number;
  label?: string;
}

export function OpenInMapsLinks({ lat, lng, label }: Props) {
  const t = useTranslations("mosques.actions");
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  const links = [
    { id: "google", href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, label: t("openInGoogle") },
    { id: "apple", href: `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`, label: t("openInApple") },
    { id: "yandex", href: `https://yandex.com/maps/?ll=${lng},${lat}&z=16&pt=${lng},${lat}`, label: t("openInYandex") },
  ];
  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((l) => (
        <li key={l.id}>
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:border-accent"
          >
            {l.label} <ExternalLink className="size-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}
