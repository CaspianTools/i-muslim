import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { BusinessesPageClient } from "@/components/admin/businesses/BusinessesPageClient";
import { fetchBusinesses, fetchBusinessSubmissions } from "@/lib/admin/data/businesses";
import { fetchCategories, fetchAmenities, fetchCertBodies } from "@/lib/admin/data/business-taxonomies";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses");
  return { title: t("pageTitle") };
}

export default async function AdminBusinessesPage() {
  const [t, tAdmin, { businesses, source }, { submissions }, { categories }, { amenities }, { certBodies }] =
    await Promise.all([
      getTranslations("businesses"),
      getTranslations("businesses.admin"),
      fetchBusinesses(),
      fetchBusinessSubmissions(),
      fetchCategories(),
      fetchAmenities(),
      fetchCertBodies(),
    ]);

  const pendingSubmissions = submissions.filter((s) => s.status === "pending_review");

  const navLinks: Array<[string, string]> = [
    ["/admin/businesses/submissions", tAdmin("tabSubmissions")],
    ["/admin/businesses/reports", tAdmin("tabReports")],
    ["/admin/businesses/categories", tAdmin("tabCategories")],
    ["/admin/businesses/cert-bodies", tAdmin("tabCertBodies")],
    ["/admin/businesses/amenities", tAdmin("tabAmenities")],
  ];

  return (
    <div>
      <PageHeader title={t("pageTitle")} />
      <nav className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {navLinks.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex h-8 items-center rounded-md border border-input px-3 hover:bg-muted"
          >
            {label}
          </Link>
        ))}
      </nav>
      <BusinessesPageClient
        initialBusinesses={businesses}
        pendingSubmissions={pendingSubmissions}
        categories={categories}
        amenities={amenities}
        certBodies={certBodies}
        canPersist={source === "firestore"}
      />
    </div>
  );
}
