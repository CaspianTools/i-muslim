import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { PrayerTimesBar } from "@/components/prayer/PrayerTimesBar";
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
      <main className="flex-1">{children}</main>
      <Footer />
      <Toaster />
    </>
  );
}
