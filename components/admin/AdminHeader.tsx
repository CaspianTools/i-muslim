import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";
import { NotificationsPopover } from "./NotificationsPopover";
import { QuickCreate } from "./QuickCreate";
import { ThemeMenu } from "./ThemeMenu";
import { UserMenu } from "./UserMenu";
import { PrayerPills } from "@/components/prayer/PrayerPills";
import type { SidebarBadges } from "./Sidebar";
import type { AdminSession } from "@/lib/auth/session";
import { BUNDLED_LOCALES } from "@/i18n/config";
import { listActivatedReservedLocales } from "@/lib/admin/data/ui-locales";
import { fetchNotifications } from "@/lib/admin/data/notifications";
import { fetchCategories } from "@/lib/admin/data/business-taxonomies";
import { fetchEventCategories } from "@/lib/admin/data/event-categories";
import { fetchArticleCategories } from "@/lib/admin/data/article-categories";
import { fetchMosqueFacilities } from "@/lib/admin/data/mosque-facilities";
import { getFirebaseAdminStatus } from "@/lib/firebase/admin";

interface AdminHeaderProps {
  session: AdminSession;
  badges?: SidebarBadges;
  logoUrl?: string | null;
}

export async function AdminHeader({ session, badges, logoUrl }: AdminHeaderProps) {
  const permissions = session.permissions;
  const [
    activated,
    { items: notifications },
    { categories },
    { categories: eventCategories },
    { categories: articleCategories },
    { facilities: mosqueFacilities },
  ] = await Promise.all([
    listActivatedReservedLocales(),
    fetchNotifications({ limit: 50 }),
    fetchCategories(),
    fetchEventCategories(),
    fetchArticleCategories(),
    fetchMosqueFacilities(),
  ]);
  const availableLocales = [...BUNDLED_LOCALES, ...activated];
  const canPersist = getFirebaseAdminStatus().configured;
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <MobileSidebarDrawer badges={badges} logoUrl={logoUrl} permissions={permissions} />
      <div className="hidden md:flex flex-1 min-w-0 items-center gap-4">
        <Breadcrumbs />
      </div>
      <div className="md:hidden flex-1 min-w-0">
        <Breadcrumbs />
      </div>
      <PrayerPills className="hidden lg:flex mx-2" interactive={false} />
      <div className="ml-auto flex items-center gap-1">
        <div className="hidden md:block">
          <CommandPalette />
        </div>
        <LanguageSwitcher availableLocales={availableLocales} />
        <ThemeMenu />
        <NotificationsPopover initialItems={notifications} />
        <QuickCreate
          categories={categories}
          eventCategories={eventCategories}
          articleCategories={articleCategories}
          mosqueFacilities={mosqueFacilities}
          canPersist={canPersist}
          adminEmail={session.email}
        />
        <UserMenu name={session.name} email={session.email} picture={session.picture} />
      </div>
    </header>
  );
}
