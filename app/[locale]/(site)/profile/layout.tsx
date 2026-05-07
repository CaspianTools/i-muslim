import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSiteSession } from "@/lib/auth/session";
import { ProfileSidebar } from "@/components/site/profile/ProfileSidebar";
import { ProfileMobileTabs } from "@/components/site/profile/ProfileMobileTabs";

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const session = await getSiteSession();
  if (!session) {
    redirect("/login?callbackUrl=/profile");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      {/* Mobile: horizontal scroll strip (auto-discoverable, no hidden
          drawer trigger). Desktop: sticky left sidebar (unchanged). */}
      <ProfileMobileTabs />
      <div className="flex gap-6">
        <aside className="hidden md:block sticky top-20 self-start">
          <ProfileSidebar variant="desktop" />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
