import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { MosqueCard } from "@/components/mosque/MosqueCard";
import { fetchPublishedMosques, fetchCityAggregates } from "@/lib/admin/data/mosques";
import { countryName, countryCodeFromSlug } from "@/lib/mosques/countries";
import { getSiteUrl } from "@/lib/mosques/constants";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country } = await params;
  const cc = countryCodeFromSlug(country);
  const name = countryName(cc);
  return {
    title: `Mosques in ${name}`,
    description: `Find mosques across ${name} — prayer times, addresses, and contact.`,
    alternates: { canonical: `${getSiteUrl()}/mosques/c/${country}` },
  };
}

export default async function CountryHub({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const countrySlug = country.toLowerCase();
  const cc = countryCodeFromSlug(countrySlug);
  const [{ mosques }, cities, t] = await Promise.all([
    fetchPublishedMosques({ countrySlug, limit: 200 }),
    fetchCityAggregates(countrySlug),
    getTranslations("mosques"),
  ]);
  if (mosques.length === 0) notFound();

  const name = countryName(cc);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <Link
        href="/mosques"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("detail.back")}
      </Link>
      <header className="mt-4 border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("hub.countryTitle", { country: name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("hub.countrySubtitle", { count: mosques.length })}
        </p>
      </header>

      {cities.length > 1 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{t("hub.byCityTitle", { country: name })}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cities.map((c) => (
              <li key={c.citySlug}>
                <Link
                  href={`/mosques/c/${countrySlug}/${c.citySlug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-accent"
                >
                  {c.city} <span className="text-xs text-muted-foreground">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
