export type AdminRole = "admin" | "moderator" | "scholar" | "member";

export type AdminUserStatus = "active" | "pending" | "suspended" | "banned";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: AdminRole;
  status: AdminUserStatus;
  verified: boolean;
  joinedAt: string; // ISO
  lastActiveAt: string; // ISO
}

export interface UserFilters {
  q?: string;
  role?: AdminRole;
  status?: AdminUserStatus;
  verified?: boolean;
}

export type NotificationType =
  | "signup"
  | "flagged"
  | "donation"
  | "qa"
  | "system"
  | "submission"
  | "contact";

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface ActivityEntry {
  id: string;
  actor: string;
  actorAvatarUrl: string | null;
  action: string;
  target: string;
  createdAt: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  startsAt: string;
  rsvpCount: number;
}

// Stored on each event as a slug pointing into the `eventCategories` Firestore
// collection (managed at /admin/events/categories). Kept as a free-form string
// so admin-defined custom categories type-check the same as built-ins.
export type EventCategory = string;

export type EventStatus = "under_review" | "draft" | "published" | "cancelled";

export type EventLocationMode = "in-person" | "online" | "hybrid";

export interface EventLocation {
  mode: EventLocationMode;
  venue?: string;
  address?: string;
  lat?: number;
  lng?: number;
  url?: string;
  platform?: string;
  dialIn?: string;
}

export type PrayerAnchor = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export interface EventStartAnchor {
  prayer: PrayerAnchor;
  offsetMinutes: number;
}

export interface HijriAnchor {
  monthIndex: number;
  day: number;
  hourLocal: number;
  minuteLocal: number;
}

export interface AdminEvent {
  id: string;
  title: string;
  description?: string;
  category: EventCategory;
  status: EventStatus;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  location: EventLocation;
  organizer: { name: string; contact?: string };
  capacity?: number;
  rsvpCount: number;
  recurrence?: string;
  startAnchor?: EventStartAnchor;
  hijriAnchor?: HijriAnchor;
  submittedBy?: { uid?: string; email?: string };
  createdAt: string;
  updatedAt: string;
}

export interface EventFilters {
  q?: string;
  category?: EventCategory;
  status?: EventStatus;
  window?: "upcoming" | "past" | "all";
}

export interface DashboardData {
  kpis: {
    totalUsers: { value: number; delta: number; sparkline: number[] };
    activeThisWeek: { value: number; delta: number; sparkline: number[] };
    pendingApprovals: { value: number; delta: number; sparkline: number[] };
    donationsThisMonth: { value: number; delta: number; sparkline: number[] };
  };
  userGrowth: {
    "30": Array<{ date: string; users: number }>;
    "90": Array<{ date: string; users: number }>;
    "365": Array<{ date: string; users: number }>;
  };
  engagementByContent: Array<{ kind: string; value: number }>;
  donationBreakdown: Array<{ category: string; value: number }>;
  recentActivity: ActivityEntry[];
  upcomingEvents: UpcomingEvent[];
}
