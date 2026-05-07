import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PrayerTimesBar } from "@/components/prayer/PrayerTimesBar";
import { MobileBottomTabBar } from "@/components/mobile/MobileBottomTabBar";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { Toaster } from "@/components/ui/sonner";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PrayerTimesBar />
      <Nav />
      {/* Bottom tab bar at <md sits above the home indicator (safe-area pad
          inside .mobile-tabbar). Pad <main> at the same height so content
          doesn't sit underneath. */}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomTabBar />
      {/* First-run welcome on the public site only — admins are signed in
          and don't need the location/calc-method walk-through. The modal
          renders nothing until its useEffect reads localStorage, so SSR
          ships the real content under it (SEO-safe, deep-link-safe). */}
      <OnboardingModal />
      <Toaster />
    </>
  );
}
