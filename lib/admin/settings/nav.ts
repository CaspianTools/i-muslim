import { Settings, Image as ImageIcon, Type, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SettingsNavLabelKey =
  | "general"
  | "media"
  | "typography"
  | "languages"
  | "languagesInterface"
  | "languagesQuran"
  | "languagesHadith";

export interface SettingsNavItem {
  id: string;
  href: string;
  // Optional URL query for sub-items (e.g. ?scope=quran).
  query?: Record<string, string>;
  labelKey: SettingsNavLabelKey;
  icon?: LucideIcon;
  children?: SettingsNavItem[];
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "general", href: "/admin/settings", labelKey: "general", icon: Settings },
  { id: "media", href: "/admin/settings/media", labelKey: "media", icon: ImageIcon },
  { id: "typography", href: "/admin/settings/typography", labelKey: "typography", icon: Type },
  {
    id: "languages",
    href: "/admin/settings/languages",
    labelKey: "languages",
    icon: Languages,
    children: [
      {
        id: "languages-interface",
        href: "/admin/settings/languages",
        labelKey: "languagesInterface",
      },
      {
        id: "languages-quran",
        href: "/admin/settings/languages",
        query: { scope: "quran" },
        labelKey: "languagesQuran",
      },
      {
        id: "languages-hadith",
        href: "/admin/settings/languages",
        query: { scope: "hadith" },
        labelKey: "languagesHadith",
      },
    ],
  },
];
