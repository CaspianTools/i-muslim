import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Calendar,
  CalendarDays,
  Clock,
  FileBarChart,
  FileText,
  GraduationCap,
  HandCoins,
  Heart,
  Image,
  Inbox,
  Landmark,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageCircleQuestion,
  MessageSquareWarning,
  Mic2,
  Plug,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Store,
  Users,
  Users2,
} from "lucide-react";

export type NavItemKey =
  | "dashboard"
  | "analytics"
  | "activity"
  | "users"
  | "roles"
  | "scholars"
  | "groups"
  | "articles"
  | "quran"
  | "hadith"
  | "duas"
  | "khutbahs"
  | "media"
  | "prayerTimes"
  | "hijriCalendar"
  | "events"
  | "mosques"
  | "qa"
  | "announcements"
  | "newsletter"
  | "moderation"
  | "donations"
  | "businesses"
  | "courses"
  | "matrimonial"
  | "contactMessages"
  | "reports"
  | "audit"
  | "settings"
  | "integrations";

export type NavGroupKey =
  | "overview"
  | "community"
  | "content"
  | "worship"
  | "engagement"
  | "services"
  | "system";

export interface NavItem {
  labelKey: NavItemKey;
  href: string;
  icon: LucideIcon;
  badgeKey?:
    | "pendingUsers"
    | "unansweredQa"
    | "flaggedContent"
    | "openReports"
    | "pendingMosques"
    | "pendingMatrimonial"
    | "openContactMessages";
}

export interface NavGroup {
  id: NavGroupKey;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    id: "overview",
    items: [
      { labelKey: "dashboard", href: "/admin", icon: LayoutDashboard },
      { labelKey: "analytics", href: "/admin/analytics", icon: BarChart3 },
      { labelKey: "activity", href: "/admin/activity", icon: Activity },
    ],
  },
  {
    id: "community",
    items: [
      { labelKey: "users", href: "/admin/users", icon: Users, badgeKey: "pendingUsers" },
      { labelKey: "roles", href: "/admin/roles", icon: Shield },
      { labelKey: "scholars", href: "/admin/scholars", icon: GraduationCap },
      { labelKey: "groups", href: "/admin/groups", icon: Users2 },
    ],
  },
  {
    id: "content",
    items: [
      { labelKey: "articles", href: "/admin/articles", icon: FileText },
      { labelKey: "quran", href: "/admin/quran", icon: BookOpen },
      { labelKey: "hadith", href: "/admin/hadith", icon: BookMarked },
      { labelKey: "duas", href: "/admin/duas", icon: Sparkles },
      { labelKey: "khutbahs", href: "/admin/khutbahs", icon: Mic2 },
      { labelKey: "media", href: "/admin/media", icon: Image },
    ],
  },
  {
    id: "worship",
    items: [
      { labelKey: "prayerTimes", href: "/admin/prayer-times", icon: Clock },
      { labelKey: "hijriCalendar", href: "/admin/hijri-calendar", icon: Calendar },
      { labelKey: "events", href: "/admin/events", icon: CalendarDays },
      { labelKey: "mosques", href: "/admin/mosques", icon: Landmark, badgeKey: "pendingMosques" },
    ],
  },
  {
    id: "engagement",
    items: [
      {
        labelKey: "qa",
        href: "/admin/qa",
        icon: MessageCircleQuestion,
        badgeKey: "unansweredQa",
      },
      { labelKey: "announcements", href: "/admin/announcements", icon: Megaphone },
      { labelKey: "newsletter", href: "/admin/newsletter", icon: Mail },
      {
        labelKey: "moderation",
        href: "/admin/moderation",
        icon: MessageSquareWarning,
        badgeKey: "flaggedContent",
      },
      {
        labelKey: "contactMessages",
        href: "/admin/contact",
        icon: Inbox,
        badgeKey: "openContactMessages",
      },
    ],
  },
  {
    id: "services",
    items: [
      { labelKey: "donations", href: "/admin/donations", icon: HandCoins },
      { labelKey: "businesses", href: "/admin/businesses", icon: Store, badgeKey: "openReports" },
      { labelKey: "courses", href: "/admin/courses", icon: BookOpenCheck },
      { labelKey: "matrimonial", href: "/admin/matrimonial", icon: Heart, badgeKey: "pendingMatrimonial" },
    ],
  },
  {
    id: "system",
    items: [
      { labelKey: "reports", href: "/admin/reports", icon: FileBarChart },
      { labelKey: "audit", href: "/admin/audit", icon: ScrollText },
      { labelKey: "settings", href: "/admin/settings", icon: Settings },
      { labelKey: "integrations", href: "/admin/integrations", icon: Plug },
    ],
  },
];

export function flattenNav(): NavItem[] {
  return ADMIN_NAV.flatMap((g) => g.items);
}

export function findNavItem(pathname: string): NavItem | null {
  const items = flattenNav();
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact;
  return (
    items
      .filter((i) => i.href !== "/admin" && pathname.startsWith(i.href))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  );
}
