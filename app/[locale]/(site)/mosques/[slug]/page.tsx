import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Globe, Mail, MapPin, Phone, Users } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { fetchMosqueBySlug, fetchAllSlugs } from "@/lib/admin/data/mosques";
import { countryName } from "@/lib/mosques/countries";
import { mosqueJsonLd } from "@/lib/mosques/jsonld";
import { getSiteUrl } from "@/lib/mosques/constants";
import { Badge } from "@/components/ui/badge";
import { MosqueMap } from "@/components/mosque/MosqueMap";
import { OpenInMapsLinks } from "@/components/mosque/OpenInMapsLinks";
import { PrayerTimesPanel } from "@/components/mosque/PrayerTimesPanel";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await fetchAllSlugs(50);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { mosque } = await fetchMosqueBySlug(slug);
  if (!mosque) return {};
  const title = `${mosque.name.en} — ${mosque.city}, ${countryName(mosque.country)}`;
  const description =
    mosque.description?.en ??
    `Prayer times, address, and contact for ${mosque.name.en} in ${mosque.city}.`;
  return {
    title,
    description,
    alternates: { canonical: `${getSiteUrl()}/mosques/${slug}` },
    openGraph: {
      title,
      description,
      url: `${getSiteUrl()}/mosques/${slug}`,
      images: mosque.coverImage?.url ? [{ url: mosque.coverImage.url }] : undefined,
      type: "website",
    },
  };
}

export default async function MosqueDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ mosque }, locale] = await Promise.all([fetchMosqueBySlug(slug), getLocale()]);
  if (!mosque) notFound();
  const t = await getTranslations("mosques.detail");
  const tFacilities = await getTranslations("mosques.services");
  const tDenomination = await getTranslations("mosques.denominations");
  const tActions = await getTranslations("mosques.actions");

  const enabledServices = (Object.keys(mosque.services) as Array<keyof typeof mosque.services>)
    .filter((k) => mosque.services[k]);

  const localizedName = mosque.name[locale as Locale] ?? mosque.name.en;
  const localizedDesc = mosque.description?.[locale as Locale] ?? mosque.description?.en;
  const isVerified = Boolean(mosque.moderation?.reviewedAt);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/mosques"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("back")}
      </Link>

      <header className="mt-4 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{tDenomination(mosque.denomination)}</Badge>
            {isVerified ? (
              <Badge variant="success">{t("verified")}</Badge>
            ) : (
              <Badge variant="warning">{t("unverified")}</Badge>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{localizedName}</h1>
          {mosque.name.ar && locale !== "ar" && (
            <p dir="rtl" lang="ar" className="font-arabic text-2xl text-accent">
              {mosque.name.ar}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4" /> {mosque.city}, {countryName(mosque.country)}
          </p>
          {localizedDesc && (
            <p
              dir={locale === "ar" ? "rtl" : "ltr"}
              className={locale === "ar" ? "font-arabic text-base" : "text-base text-muted-foreground"}
            >
              {localizedDesc}
            </p>
          )}
        </div>
        {mosque.coverImage?.url && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
            <Image
              src={mosque.coverImage.url}
              alt=""
              fill
              sizes="(min-width: 768px) 320px, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <PrayerTimesPanel mosque={mosque} locale={locale} />

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">{t("address")}</h2>
            <address className="mt-2 not-italic text-sm text-muted-foreground">
              <div>{mosque.address.line1}</div>
              {mosque.address.line2 && <div>{mosque.address.line2}</div>}
              <div>
                {mosque.city}{mosque.region ? `, ${mosque.region}` : ""}{mosque.address.postalCode ? ` ${mosque.address.postalCode}` : ""}
              </div>
              <div>{countryName(mosque.country)}</div>
            </address>
            <div className="mt-3">
              <OpenInMapsLinks lat={mosque.location.lat} lng={mosque.location.lng} label={mosque.name.en} />
            </div>
            <div className="mt-4">
              <MosqueMap lat={mosque.location.lat} lng={mosque.location.lng} label={mosque.name.en} />
            </div>
          </section>

          {enabledServices.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("facilities")}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {enabledServices.map((s) => (
                  <li key={s} className="text-sm text-muted-foreground">
                    · {tFacilities(s)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {(mosque.contact?.phone || mosque.contact?.email || mosque.contact?.website) && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("contact")}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {mosque.contact?.phone && (
                  <li>
                    <a
                      href={`tel:${mosque.contact.phone}`}
                      className="inline-flex items-center gap-2 text-foreground hover:text-accent"
                    >
                      <Phone className="size-4" /> {mosque.contact.phone}
                    </a>
                  </li>
                )}
                {mosque.contact?.email && (
                  <li>
                    <a
                      href={`mailto:${mosque.contact.email}`}
                      className="inline-flex items-center gap-2 text-foreground hover:text-accent"
                    >
                      <Mail className="size-4" /> {tActions("emailMosque")}
                    </a>
                  </li>
                )}
                {mosque.contact?.website && (
                  <li>
                    <a
                      href={mosque.contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-foreground hover:text-accent"
                    >
                      <Globe className="size-4" /> {tActions("visitWebsite")}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}

          {mosque.languages.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("languages")}</h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {mosque.languages.map((l) => (
                  <li key={l}>
                    <Badge variant="neutral">{l.toUpperCase()}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mosque.capacity && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">{t("capacity")}</h2>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                {t("capacityValue", { count: mosque.capacity })}
              </p>
            </section>
          )}

          <section className="rounded-xl border border-dashed border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">{t("reportTitle")}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{t("reportNote")}</p>
            <a
              href={`mailto:admin@i-muslim.app?subject=${encodeURIComponent(`Report: ${mosque.name.en} (${mosque.slug})`)}`}
              className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              {tActions("report")}
            </a>
          </section>
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mosqueJsonLd(mosque)) }}
      />
    </div>
  );
}
