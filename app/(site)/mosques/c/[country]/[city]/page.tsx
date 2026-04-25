import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { MosqueCard } from "@/components/mosque/MosqueCard";
import { fetchPublishedMosques } from "@/lib/admin/data/mosques";
import { countryName, countryCodeFromSlug } from "@/lib/mosques/countries";
import { getSiteUrl } from "@/lib/mosques/constants";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; city: string }>;
}): Promise<Metadata> {
  const { country, city } = await params;
  const cc = countryCodeFromSlug(country);
  const name = countryName(cc);
  const cityLabel = city.replace(/-/g, " ");
  return {
    title: `Mosques in ${cityLabel}, ${name}`,
    description: `Find mosques in ${cityLabel}, ${name} — prayer times, addresses, and contact.`,
    alternates: { canonical: `${getSiteUrl()}/mosques/c/${country}/${city}` },
  };
}

export default async function CityHub({
  params,
}: {
  params: Promise<{ country: string; city: string }>;
}) {
  const { country, city } = await params;
  const countrySlug = country.toLowerCase();
  const citySlug = city.toLowerCase();
  const [{ mosques }, t] = await Promise.all([
    fetchPublishedMosques({ countrySlug, citySlug, limit: 100 }),
    getTranslations("mosques"),
  ]);
  if (mosques.length === 0) notFound();

  const cc = countryCodeFromSlug(countrySlug);
  const name = countryName(cc);
  const cityName = mosques[0]?.city ?? citySlug;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link
        href={`/mosques/c/${countrySlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {name}
      </Link>
      <header className="mt-4 border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("hub.cityTitle", { city: cityName, country: name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("hub.citySubtitle", { count: mosques.length })}
        </p>
      </header>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mosques.map((m) => (
          <li key={m.slug}>
            <MosqueCard mosque={m} />
          </li>
        ))}
      </ul>
    </div>
  );
}
