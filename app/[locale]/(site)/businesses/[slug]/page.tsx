import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, AtSign, ExternalLink, Globe, Mail, MapPin, Phone, MessageCircle } from "lucide-react";
import { getBySlug } from "@/lib/businesses/public";
import { fetchAmenities, fetchCategories, fetchCertBodies } from "@/lib/admin/data/business-taxonomies";
import { buildLocalBusinessJsonLd } from "@/lib/businesses/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HalalBadge } from "@/components/businesses/HalalBadge";
import { HoursDisplay } from "@/components/businesses/HoursDisplay";
import { ReportListingDialog } from "@/components/businesses/ReportListingDialog";
import type { Locale } from "@/i18n/config";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

function bucketUrl(storagePath: string): string {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) return "";
  return `https://storage.googleapis.com/${bucket}/${encodeURI(storagePath)}`;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBySlug(slug);
  if (!business) return { title: "Not found" };
  return {
    title: business.name,
    description: business.description.en,
    openGraph: {
      title: business.name,
      description: business.description.en,
      type: "website",
    },
  };
}

export default async function BusinessDetailPage({ params }: RouteParams) {
  const { slug } = await params;
  const business = await getBySlug(slug);
  if (!business) notFound();

  const [{ categories }, { amenities }, { certBodies }] = await Promise.all([
    fetchCategories(),
    fetchAmenities(),
    fetchCertBodies(),
  ]);

  const t = await getTranslations("businesses");
  const tHalal = await getTranslations("businesses.halal");
  const locale = (await getLocale()) as Locale;

  const certBody = business.halal.certificationBodyId
    ? certBodies.find((b) => b.id === business.halal.certificationBodyId) ?? null
    : null;
  const businessCategories = business.categoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const businessAmenities = business.amenityIds
    .map((id) => amenities.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const description = business.description[locale] ?? business.description.en;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://i-muslim.com";
  const jsonLd = buildLocalBusinessJsonLd(business, baseUrl);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${business.address.lat},${business.address.lng}`;

  const claimMailto = `mailto:fuad.jalilov@gmail.com?subject=${encodeURIComponent(
    t("detail.claimMailtoSubject", { name: business.name }),
  )}&body=${encodeURIComponent(t("detail.claimMailtoBody", { name: business.name, slug: business.slug }))}`;

  return (
    <article className="mx-auto max-w-4xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/businesses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("detail.back")}
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{business.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {business.address.line1}, {business.address.city}
              {businessCategories.length > 0 && (
                <>
                  <span aria-hidden>·</span>
                  <span>{businessCategories[0]!.name[locale] ?? businessCategories[0]!.name.en}</span>
                </>
              )}
              {business.priceTier && (
                <>
                  <span aria-hidden>·</span>
                  <span>{"$".repeat(business.priceTier)}</span>
                </>
              )}
            </p>
          </div>
          <HoursDisplay hours={business.hours} variant="compact" />
        </div>

        <div className="mt-4">
          <HalalBadge business={business} certBody={certBody} />
        </div>

        {business.halal.status === "certified" && (
          <div className="mt-2 text-xs text-muted-foreground">
            {certBody && <>{tHalal("by", { body: certBody.name })} · </>}
            {business.halal.certificationNumber && (
              <>{tHalal("certNo", { number: business.halal.certificationNumber })}</>
            )}
            {business.halal.expiresAt && (
              <>
                {" · "}
                {tHalal("expires", {
                  date: new Date(business.halal.expiresAt).toLocaleDateString(locale),
                })}
              </>
            )}
          </div>
        )}
        {business.platformVerifiedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            {tHalal("platformCheckedOn", {
              date: new Date(business.platformVerifiedAt).toLocaleDateString(locale),
            })}
          </p>
        )}
      </header>

      {business.photos.length > 0 && (
        <section className="mt-6">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {business.photos.slice(0, 6).map((photo) => (
              <li key={photo.storagePath} className="overflow-hidden rounded-lg border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bucketUrl(photo.storagePath)}
                  alt={photo.alt ?? business.name}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 grid gap-8 sm:grid-cols-3">
        <div className="space-y-6 sm:col-span-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.about")}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{description}</p>
          </div>

          {businessAmenities.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("detail.amenities")}
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {businessAmenities.map((a) => (
                  <Badge key={a.id} variant="neutral">
                    {a.name[locale] ?? a.name.en}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.hours")}
            </h2>
            <HoursDisplay hours={business.hours} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.contact")}
            </h2>
            <ul className="space-y-2 text-sm">
              {business.contact.phone && (
                <li>
                  <a className="inline-flex items-center gap-2 hover:underline" href={`tel:${business.contact.phone}`}>
                    <Phone className="size-4" /> {business.contact.phone}
                  </a>
                </li>
              )}
              {business.contact.email && (
                <li>
                  <a className="inline-flex items-center gap-2 hover:underline" href={`mailto:${business.contact.email}`}>
                    <Mail className="size-4" /> {business.contact.email}
                  </a>
                </li>
              )}
              {business.contact.website && (
                <li>
                  <a className="inline-flex items-center gap-2 hover:underline" href={business.contact.website} target="_blank" rel="noopener noreferrer">
                    <Globe className="size-4" /> {business.contact.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              )}
              {business.contact.instagram && (
                <li>
                  <a
                    className="inline-flex items-center gap-2 hover:underline"
                    href={`https://instagram.com/${business.contact.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AtSign className="size-4" /> {business.contact.instagram}
                  </a>
                </li>
              )}
              {business.contact.whatsapp && (
                <li>
                  <a
                    className="inline-flex items-center gap-2 hover:underline"
                    href={`https://wa.me/${business.contact.whatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="size-4" /> WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("detail.location")}
            </h2>
            <p className="text-sm">{business.address.line1}</p>
            <p className="text-sm">
              {business.address.city}
              {business.address.region ? `, ${business.address.region}` : ""}
              {business.address.postalCode ? ` ${business.address.postalCode}` : ""}
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> {t("detail.openInMaps")}
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <a href={claimMailto}>{t("detail.claim")}</a>
            </Button>
            <ReportListingDialog businessId={business.id} businessName={business.name} />
          </div>
        </aside>
      </section>
    </article>
  );
}
