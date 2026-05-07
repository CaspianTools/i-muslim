import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { pickLocalized } from "@/lib/utils";
import { fetchMosqueBySlug, fetchAllSlugs } from "@/lib/admin/data/mosques";
import { countryName } from "@/lib/mosques/countries";
import { mosqueJsonLd } from "@/lib/mosques/jsonld";
import { getSiteUrl } from "@/lib/mosques/constants";
import { MosqueProfile } from "@/components/mosque/MosqueProfile";
import { MosqueEventsCard } from "@/components/mosque/MosqueEventsCard";
import { CommentThread } from "@/components/comments/CommentThread";
import { canManageMosque } from "@/lib/mosques/authz";

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

  const localizedName = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;

  // The events card hides itself for non-managers when there are no events,
  // so unauthenticated visitors see nothing extra. Managers (and admins) see
  // the card with an "Add event" CTA even on empty mosques.
  const canAddEvent = await canManageMosque(mosque.slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/mosques"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {t("back")}
      </Link>

      <div className="mt-4">
        <MosqueProfile
          mosque={mosque}
          eventsSlot={
            <MosqueEventsCard mosqueSlug={mosque.slug} canAddEvent={canAddEvent} />
          }
        />
      </div>

      <CommentThread
        entityType="mosque"
        entityId={mosque.slug}
        itemMeta={{
          title: localizedName,
          subtitle: `${mosque.city}, ${countryName(mosque.country)}`,
          href: `/mosques/${mosque.slug}`,
          locale,
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mosqueJsonLd(mosque)) }}
      />
    </div>
  );
}
