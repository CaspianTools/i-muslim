import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HijriDate } from "@/components/admin/HijriDate";
import { PrayerTimesWidget } from "@/components/admin/PrayerTimesWidget";
import { StatCard } from "@/components/admin/StatCard";
import { UserGrowthChart } from "@/components/admin/charts/UserGrowthChart";
import { EngagementBarChart } from "@/components/admin/charts/EngagementBarChart";
import { DonationDonutChart } from "@/components/admin/charts/DonationDonutChart";
import { requireAdminSession } from "@/lib/auth/session";
import { fetchDashboard } from "@/lib/admin/data/dashboard";
import { formatRelative, initials } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("sidebar.items");
  return { title: t("dashboard") };
}

function firstName(name: string | null, email: string, fallback: string): string {
  if (name) return name.split(/\s+/)[0] ?? name;
  return email.split("@")[0] ?? fallback;
}

function formatUsd(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

export default async function DashboardPage() {
  const session = await requireAdminSession();
  const data = await fetchDashboard();
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  const greetingName = firstName(session.name, session.email, t("fallbackFirstName"));
  const today = new Date().toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("greeting", { name: greetingName })}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <HijriDate />
            <span aria-hidden>·</span>
            <span>{today}</span>
          </div>
        </div>
        <div className="md:min-w-[320px] md:flex-1 md:max-w-[560px]">
          <PrayerTimesWidget />
        </div>
      </div>

      {data.source === "mock" && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="text-foreground">
            {t("sampleDataBanner")}{" "}
            <span className="text-muted-foreground">
              {t.rich("sampleDataBannerHelp", {
                file: () => (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.example</code>
                ),
                usersCol: () => (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">users</code>
                ),
                donationsCol: () => (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">donations</code>
                ),
                db: () => (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">main</code>
                ),
              })}
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("kpi.totalUsers")}
          value={data.kpis.totalUsers.value}
          delta={data.kpis.totalUsers.delta}
          sparkline={data.kpis.totalUsers.sparkline}
        />
        <StatCard
          label={t("kpi.activeThisWeek")}
          value={data.kpis.activeThisWeek.value}
          delta={data.kpis.activeThisWeek.delta}
          sparkline={data.kpis.activeThisWeek.sparkline}
        />
        <StatCard
          label={t("kpi.pendingApprovals")}
          value={data.kpis.pendingApprovals.value}
          delta={data.kpis.pendingApprovals.delta}
          sparkline={data.kpis.pendingApprovals.sparkline}
        />
        <StatCard
          label={t("kpi.donationsThisMonth")}
          value={formatUsd(data.kpis.donationsThisMonth.value)}
          delta={data.kpis.donationsThisMonth.delta}
          sparkline={data.kpis.donationsThisMonth.sparkline}
        />
      </div>

      <UserGrowthChart data={data.userGrowth} />

      <div className="grid gap-4 lg:grid-cols-2">
        <EngagementBarChart data={data.engagementByContent} />
        <DonationDonutChart data={data.donationBreakdown} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-3">
          <div className="pb-3">
            <h2 className="text-sm font-semibold text-foreground">{t("activity.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("activity.subtitle")}</p>
          </div>
          <ul className="divide-y divide-border">
            {data.recentActivity.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3">
                <Avatar className="size-8 shrink-0">
                  {entry.actorAvatarUrl && <AvatarImage src={entry.actorAvatarUrl} alt="" />}
                  <AvatarFallback>{initials(entry.actor)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{entry.actor}</span>{" "}
                    <span className="text-muted-foreground">{entry.action}</span>{" "}
                    <span>{entry.target}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">{formatRelative(entry.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
          <div className="pb-3">
            <h2 className="text-sm font-semibold text-foreground">{t("events.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("events.subtitle")}</p>
          </div>
          <ul className="divide-y divide-border">
            {data.upcomingEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.startsAt).toLocaleDateString(locale, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {t("events.rsvps", { count: e.rsvpCount })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
