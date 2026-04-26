import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSession, getSiteSession } from "@/lib/auth/session";
import { getFirebaseAdminStatus } from "@/lib/firebase/admin";
import { Sidebar, type SidebarBadges } from "@/components/admin/Sidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Toaster } from "@/components/ui/sonner";
import { countOpenReports } from "@/lib/admin/data/business-reports";
import { listProfiles } from "@/lib/matrimonial/store";
import { countPendingMosques } from "@/lib/admin/data/mosques";
import { countOpenContactMessages } from "@/lib/admin/data/contact-messages";
import { countPendingUsers } from "@/lib/admin/data/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · i-muslim Admin",
  },
};

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const status = getFirebaseAdminStatus();
  if (!status.configured) {
    redirect(`/${locale}/login`);
  }

  const siteSession = await getSiteSession();
  if (!siteSession) {
    redirect(`/${locale}/login`);
  }
  const session = await getAdminSession();
  if (!session) {
    // Signed in but not in the admin allowlist — bounce to home.
    redirect(`/${locale}/`);
  }

  const [
    openReports,
    { profiles: matrimonialProfiles },
    pendingMosques,
    openContactMessages,
    pendingUsers,
  ] = await Promise.all([
    countOpenReports(),
    listProfiles(),
    countPendingMosques(),
    countOpenContactMessages(),
    countPendingUsers(),
  ]);
  const pendingMatrimonial = matrimonialProfiles.filter((p) => p.status === "pending").length;

  const badges: SidebarBadges = {
    pendingUsers,
    openReports,
    pendingMatrimonial,
    pendingMosques,
    openContactMessages,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="hidden md:block shrink-0">
        <Sidebar badges={badges} />
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <AdminHeader session={session} badges={badges} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
