import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
      <Toaster />
    </>
  );
}
