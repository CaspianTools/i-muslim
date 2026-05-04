import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { listPublished } from "@/lib/businesses/public";
import {
  fetchAmenities,
  fetchCategories,
  fetchCertBodies,
} from "@/lib/admin/data/business-taxonomies";
import { BusinessCard } from "@/components/businesses/BusinessCard";
import { BusinessFilters } from "@/components/businesses/BusinessFilters";
import type { HalalStatus, PriceTier } from "@/types/business";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses");
  const title = t("publicTitle");
  return {
    title,
    description: t("publicSubtitle"),
    openGraph: { title, description: t("publicSubtitle") },
  };
}

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations("businesses");
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const category = typeof params.category === "string" ? params.category : undefined;
  const halal = typeof params.halal === "string" ? (params.halal as HalalStatus) : undefined;
  const amenity = typeof params.amenity === "string" ? params.amenity : undefined;
  const priceRaw = typeof params.price === "string" ? Number(params.price) : NaN;
  const price: PriceTier | undefined =
    priceRaw === 1 || priceRaw === 2 || priceRaw === 3 || priceRaw === 4
      ? (priceRaw as PriceTier)
      : undefined;

  const [{ businesses }, { categories }, { amenities }, { certBodies }] = await Promise.all([
    listPublished({ categoryId: category }),
    fetchCategories(),
    fetchAmenities(),
    fetchCertBodies(),
  ]);

  const filtered = businesses
    .filter((b) => !halal || b.halal.status === halal)
    .filter((b) => !amenity || b.amenityIds.includes(amenity))
    .filter((b) => !price || b.priceTier === price)
    .filter((b) => {
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.description.en.toLowerCase().includes(q) ||
        b.address.city.toLowerCase().includes(q)
      );
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("publicTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("publicSubtitle")}</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/businesses/submit">
            <Plus /> {t("submitCta")}
          </Link>
        </Button>
      </header>

      <div className="mb-6">
        <BusinessFilters
          categories={categories}
          amenities={amenities}
          total={filtered.length}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <p className="font-medium">{t("publicEmpty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("publicEmptyHint")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <li key={b.id}>
              <BusinessCard business={b} categories={categories} certBodies={certBodies} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
