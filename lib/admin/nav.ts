import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  Clock,
  ConciergeBell,
  FileBarChart,
  FileText,
  Flag,
  GraduationCap,
  HandCoins,
  Heart,
  Image,
  Inbox,
  Landmark,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageCircle,
  MessageCircleQuestion,
  MessageSquareWarning,
  Mic2,
  Plug,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Store,
  Tags,
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
  | "articlesCategories"
  | "quran"
  | "hadith"
  | "duas"
  | "khutbahs"
  | "media"
  | "prayerTimes"
  | "events"
  | "eventsCategories"
  | "mosques"
  | "qa"
  | "announcements"
  | "newsletter"
  | "moderation"
  | "comments"
  | "donations"
  | "businesses"
  | "businessesCategories"
  | "businessesReports"
  | "businessesCertBodies"
  | "businessesAmenities"
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
  | "system";

export interface NavItem {
  labelKey: NavItemKey;
  href: string;
  icon: LucideIcon;
  badgeKey?:
    | "pendingUsers"
    | "openReports"
    | "pendingMosques"
    | "pendingMatrimonial"
    | "openContactMessages"
    | "autoHiddenComments";
  children?: NavItem[];
  comingSoon?: boolean;
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
      { labelKey: "analytics", href: "/admin/analytics", icon: BarChart3, comingSoon: true },
      { labelKey: "activity", href: "/admin/activity", icon: Activity, comingSoon: true },
    ],
  },
  {
    id: "community",
    items: [
      { labelKey: "users", href: "/admin/users", icon: Users, badgeKey: "pendingUsers" },
      { labelKey: "roles", href: "/admin/roles", icon: Shield, comingSoon: true },
      { labelKey: "scholars", href: "/admin/scholars", icon: GraduationCap, comingSoon: true },
      { labelKey: "groups", href: "/admin/groups", icon: Users2, comingSoon: true },
    ],
  },
  {
    id: "content",
    items: [
      {
        labelKey: "articles",
        href: "/admin/articles",
        icon: FileText,
        children: [
          { labelKey: "articlesCategories", href: "/admin/articles/categories", icon: Tags },
        ],
      },
      { labelKey: "quran", href: "/admin/quran", icon: BookOpen },
      { labelKey: "hadith", href: "/admin/hadith", icon: BookMarked },
      {
        labelKey: "events",
        href: "/admin/events",
        icon: CalendarDays,
        children: [
          { labelKey: "eventsCategories", href: "/admin/events/categories", icon: Tags },
        ],
      },
      { labelKey: "mosques", href: "/admin/mosques", icon: Landmark, badgeKey: "pendingMosques" },
      {
        labelKey: "businesses",
        href: "/admin/businesses",
        icon: Store,
        badgeKey: "openReports",
        children: [
          { labelKey: "businessesCategories", href: "/admin/businesses/categories", icon: Tags },
          { labelKey: "businessesReports", href: "/admin/businesses/reports", icon: Flag },
          { labelKey: "businessesCertBodies", href: "/admin/businesses/cert-bodies", icon: BadgeCheck },
          { labelKey: "businessesAmenities", href: "/admin/businesses/amenities", icon: ConciergeBell },
        ],
      },
      { labelKey: "courses", href: "/admin/courses", icon: BookOpenCheck },
      { labelKey: "matrimonial", href: "/admin/matrimonial", icon: Heart, badgeKey: "pendingMatrimonial" },
      { labelKey: "duas", href: "/admin/duas", icon: Sparkles, comingSoon: true },
      { labelKey: "khutbahs", href: "/admin/khutbahs", icon: Mic2, comingSoon: true },
      { labelKey: "media", href: "/admin/media", icon: Image, comingSoon: true },
    ],
  },
  {
    id: "worship",
    items: [
      { labelKey: "prayerTimes", href: "/admin/prayer-times", icon: Clock },
    ],
  },
  {
    id: "engagement",
    items: [
      {
        labelKey: "comments",
        href: "/admin/comments",
        icon: MessageCircle,
        badgeKey: "autoHiddenComments",
      },
      {
        labelKey: "contactMessages",
        href: "/admin/contact",
        icon: Inbox,
        badgeKey: "openContactMessages",
      },
      { labelKey: "qa", href: "/admin/qa", icon: MessageCircleQuestion, comingSoon: true },
      { labelKey: "announcements", href: "/admin/announcements", icon: Megaphone, comingSoon: true },
      { labelKey: "newsletter", href: "/admin/newsletter", icon: Mail, comingSoon: true },
      { labelKey: "moderation", href: "/admin/moderation", icon: MessageSquareWarning, comingSoon: true },
    ],
  },
  {
    id: "system",
    items: [
      { labelKey: "settings", href: "/admin/settings", icon: Settings },
      { labelKey: "integrations", href: "/admin/integrations", icon: Plug },
      { labelKey: "donations", href: "/admin/donations", icon: HandCoins, comingSoon: true },
      { labelKey: "reports", href: "/admin/reports", icon: FileBarChart, comingSoon: true },
      { labelKey: "audit", href: "/admin/audit", icon: ScrollText, comingSoon: true },
    ],
  },
];

export function flattenNav(): NavItem[] {
  return ADMIN_NAV.flatMap((g) =>
    g.items.flatMap((item) => (item.children ? [item, ...item.children] : [item])),
  );
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
