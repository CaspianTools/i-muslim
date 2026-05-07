import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MosqueCard } from "@/components/mosque/MosqueCard";
import { MosqueFilters } from "@/components/mosque/MosqueFilters";
import { PullToRefresh } from "@/components/site/PullToRefresh";
import { fetchPublishedMosques, fetchCountryAggregates } from "@/lib/admin/data/mosques";
import { parseNearParam } from "@/lib/mosques/geo";
import { countryName } from "@/lib/mosques/countries";
import { mosqueListJsonLd } from "@/lib/mosques/jsonld";
import { getSiteUrl } from "@/lib/mosques/constants";
import type { Denomination, MosqueFilters as MFilters } from "@/types/mosque";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosques");
  return {
    title: t("directory"),
    description: t("subtitle"),
    alternates: { canonical: `${getSiteUrl()}/mosques` },
  };
}

export default async function MosquesIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; country?: string; city?: string; denomination?: string; near?: string }>;
}) {
  const sp = await searchParams;
  const filters: MFilters = {
    q: sp.q,
    country: sp.country,
    city: sp.city,
    denomination: sp.denomination as Denomination | undefined,
    near: parseNearParam(sp.near) ?? undefined,
    limit: 200,
  };
  const [{ mosques, source, total }, countries, t, tResults, tNearMe] = await Promise.all([
    fetchPublishedMosques(filters),
    fetchCountryAggregates(),
    getTranslations("mosques"),
    getTranslations("mosques.results"),
    getTranslations("mosques.nearMe"),
  ]);

  const countryOptions = countries.map((c) => ({ slug: c.countrySlug, name: countryName(c.country) }));
  const total_ = total ?? mosques.length;
  const countLabel = total_ === 1 ? tResults("countOne", { count: total_ }) : tResults("countOther", { count: total_ });

  return (
    <PullToRefresh>
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{t("directory")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/mosques/near-me">
                <MapPin /> {tNearMe("title")}
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/mosques/submit">
                <Plus /> {t("actions.addMosque")}
              </Link>
            </Button>
          </div>
        </div>
        <MosqueFilters countries={countryOptions} />
        {source === "mock" && (
          <p className="text-xs text-muted-foreground">
            {t("subtitle")} — showing seed data; configure Firebase to load live mosques.
          </p>
        )}
      </header>

      <p className="mt-6 text-sm text-muted-foreground">{countLabel}</p>

      {mosques.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={<MapPin className="size-5" />}
            title={tResults("noResults")}
            description={tResults("noResultsHint")}
            actions={
              <Button asChild size="sm">
                <Link href="/mosques/submit">{t("submitCta")}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mosques.map((m) => (
            <li key={m.slug}>
              <MosqueCard mosque={m} />
            </li>
          ))}
        </ul>
      )}

      {countries.length > 0 && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">{t("hub.byCountryTitle")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {countries.map((c) => (
              <li key={c.countrySlug}>
                <Link
                  href={`/mosques/c/${c.countrySlug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-accent"
                >
                  <span className="font-medium">{countryName(c.country)}</span>
                  <span className="text-xs text-muted-foreground">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(mosqueListJsonLd(mosques.slice(0, 50), `${getSiteUrl()}/mosques`)),
        }}
      />
    </div>
    </PullToRefresh>
  );
}
