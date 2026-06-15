import {
  Globe,
  MapPin,
  UserRound,
  Cookie,
  Mail,
  Smartphone,
  Database,
  HardDrive,
  KeyRound,
  Baby,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// A single sub-section the reader can jump to. `id` is the DOM id of the
// matching <h3> on the privacy page; `labelKey` is relative to the
// `legal.privacy` translation namespace.
export interface PrivacyTocItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
}

// A top-level group whose header maps to a <section> id on the page.
export interface PrivacyTocGroup {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  items: PrivacyTocItem[];
}

// Single source of truth shared by the server page (which emits the section /
// heading ids) and the client TOC sidebar (which renders the tree), so the
// anchors and the navigation can never drift apart. Every `labelKey` already
// exists under `legal.privacy` in messages/<locale>.json.
export const PRIVACY_TOC: PrivacyTocGroup[] = [
  {
    id: "website",
    labelKey: "webHeading",
    icon: Globe,
    items: [
      { id: "website-location", labelKey: "h1", icon: MapPin },
      { id: "website-account", labelKey: "h2", icon: UserRound },
      { id: "website-tracking", labelKey: "h3", icon: Cookie },
      { id: "website-contact", labelKey: "h4", icon: Mail },
    ],
  },
  {
    // Preserved id — existing deep-link target (e.g. /privacy#android-app).
    id: "android-app",
    labelKey: "app.heading",
    icon: Smartphone,
    items: [
      { id: "app-collect", labelKey: "app.collectHeading", icon: Database },
      { id: "app-store", labelKey: "app.storeHeading", icon: HardDrive },
      { id: "app-permissions", labelKey: "app.permissionsHeading", icon: KeyRound },
      { id: "app-children", labelKey: "app.childrenHeading", icon: Baby },
      { id: "app-changes", labelKey: "app.changesHeading", icon: RefreshCw },
      { id: "app-contact", labelKey: "app.contactHeading", icon: Mail },
    ],
  },
];

// Flat, document-ordered list of every observable id (group headers + items),
// used by the scroll-spy to resolve the active section.
export const PRIVACY_TOC_IDS: string[] = PRIVACY_TOC.flatMap((group) => [
  group.id,
  ...group.items.map((item) => item.id),
]);
