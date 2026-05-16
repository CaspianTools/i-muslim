import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions/catalog";
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
  KeyRound,
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
  | "mosquesFacilities"
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
  | "integrations"
  | "apiKeys";

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
  // Required permission to see this nav entry. If unset, the item is visible
  // to anyone who can access the admin shell. Coming-soon items are exempt
  // from filtering (they render disabled regardless).
  requiredPermission?: Permission;
}

export interface NavGroup {
  id: NavGroupKey;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    id: "overview",
    items: [
      { labelKey: "dashboard", href: "/admin", icon: LayoutDashboard, requiredPermission: "dashboard.read" },
      { labelKey: "analytics", href: "/admin/analytics", icon: BarChart3, comingSoon: true },
      { labelKey: "activity", href: "/admin/activity", icon: Activity, comingSoon: true },
    ],
  },
  {
    id: "community",
    items: [
      { labelKey: "users", href: "/admin/users", icon: Users, badgeKey: "pendingUsers", requiredPermission: "users.read" },
      { labelKey: "roles", href: "/admin/roles", icon: Shield, requiredPermission: "roles.read" },
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
        requiredPermission: "articles.read",
        children: [
          { labelKey: "articlesCategories", href: "/admin/articles/categories", icon: Tags, requiredPermission: "articles.read" },
        ],
      },
      { labelKey: "quran", href: "/admin/quran", icon: BookOpen, requiredPermission: "quran.read" },
      { labelKey: "hadith", href: "/admin/hadith", icon: BookMarked, requiredPermission: "hadith.read" },
      {
        labelKey: "events",
        href: "/admin/events",
        icon: CalendarDays,
        requiredPermission: "events.read",
        children: [
          { labelKey: "eventsCategories", href: "/admin/events/categories", icon: Tags, requiredPermission: "events.read" },
        ],
      },
      {
        labelKey: "mosques",
        href: "/admin/mosques",
        icon: Landmark,
        badgeKey: "pendingMosques",
        requiredPermission: "mosques.read",
        children: [
          { labelKey: "mosquesFacilities", href: "/admin/mosques/facilities", icon: ConciergeBell, requiredPermission: "mosques.read" },
        ],
      },
      {
        labelKey: "businesses",
        href: "/admin/businesses",
        icon: Store,
        badgeKey: "openReports",
        requiredPermission: "businesses.read",
        children: [
          { labelKey: "businessesCategories", href: "/admin/businesses/categories", icon: Tags, requiredPermission: "businesses.read" },
          { labelKey: "businessesReports", href: "/admin/businesses/reports", icon: Flag, requiredPermission: "businesses.read" },
          { labelKey: "businessesCertBodies", href: "/admin/businesses/cert-bodies", icon: BadgeCheck, requiredPermission: "businesses.read" },
          { labelKey: "businessesAmenities", href: "/admin/businesses/amenities", icon: ConciergeBell, requiredPermission: "businesses.read" },
        ],
      },
      { labelKey: "courses", href: "/admin/courses", icon: BookOpenCheck },
      { labelKey: "matrimonial", href: "/admin/matrimonial", icon: Heart, badgeKey: "pendingMatrimonial", requiredPermission: "matrimonial.read" },
      { labelKey: "duas", href: "/admin/duas", icon: Sparkles, comingSoon: true },
      { labelKey: "khutbahs", href: "/admin/khutbahs", icon: Mic2, comingSoon: true },
      { labelKey: "media", href: "/admin/media", icon: Image, comingSoon: true },
    ],
  },
  {
    id: "worship",
    items: [
      { labelKey: "prayerTimes", href: "/admin/prayer-times", icon: Clock, requiredPermission: "prayerTimes.read" },
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
        requiredPermission: "comments.read",
      },
      {
        labelKey: "contactMessages",
        href: "/admin/contact",
        icon: Inbox,
        badgeKey: "openContactMessages",
        requiredPermission: "contact.read",
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
      { labelKey: "settings", href: "/admin/settings", icon: Settings, requiredPermission: "settings.read" },
      { labelKey: "apiKeys", href: "/admin/api-keys", icon: KeyRound, requiredPermission: "apiKeys.read" },
      { labelKey: "integrations", href: "/admin/integrations", icon: Plug, requiredPermission: "integrations.read" },
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
