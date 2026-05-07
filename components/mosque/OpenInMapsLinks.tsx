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
    // At <md the three buttons share the row evenly (flex-1) so Yandex
    // doesn't get pushed onto a second row by itself. At md+ they keep
    // their content width.
    <ul className="flex gap-2">
      {links.map((l) => (
        <li key={l.id} className="flex-1 min-w-0 md:flex-none">
          <a
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex md:inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 md:py-1.5 text-sm hover:border-accent"
          >
            <span className="truncate">{l.label}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}
