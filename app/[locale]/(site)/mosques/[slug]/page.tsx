import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { pickLocalized } from "@/lib/utils";
import { fetchMosqueBySlug, fetchAllSlugs } from "@/lib/admin/data/mosques";
import { countryName } from "@/lib/mosques/countries";
import { mosqueJsonLd } from "@/lib/mosques/jsonld";
import { MosqueCommunityHome } from "@/components/mosque/community/MosqueCommunityHome";
import { MosqueManagePanel } from "@/components/mosque/MosqueManagePanel";
import { MosqueFollowButton } from "@/components/mosque/MosqueFollowButton";
import { MosqueLikeButton } from "@/components/mosque/MosqueLikeButton";
import { MosqueShareButton } from "@/components/mosque/community/MosqueShareButton";
import { canManageMosque } from "@/lib/mosques/authz";
import { getSiteSession } from "@/lib/auth/session";
import { isFollowingMosque } from "@/lib/mosques/follows";
import { isLikingMosque } from "@/lib/mosques/likes";
import { getMosqueAnalytics } from "@/lib/mosques/analytics";
import { hasPermission } from "@/lib/permissions/check";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { type Locale } from "@/i18n/config";

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
  const locale = (await getLocale()) as Locale;
  const title = `${mosque.name.en} — ${mosque.city}, ${countryName(mosque.country)}`;
  const description =
    mosque.description?.en ??
    `Prayer times, address, and contact for ${mosque.name.en} in ${mosque.city}.`;
  return buildPageMetadata({
    locale,
    path: `/mosques/${slug}`,
    title,
    description,
    images: mosque.coverImage?.url ? [{ url: mosque.coverImage.url }] : undefined,
  });
}

function parseView(v: string | undefined): "posts" | "about" | "events" {
  return v === "about" ? "about" : v === "events" ? "events" : "posts";
}

export default async function MosqueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ slug }, { view: viewParam }] = await Promise.all([params, searchParams]);
  const [{ mosque }, locale] = await Promise.all([fetchMosqueBySlug(slug), getLocale()]);
  if (!mosque) notFound();
  const t = await getTranslations("mosques.detail");

  const localizedName = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;

  // The events card hides itself for non-managers when there are no events,
  // so unauthenticated visitors see nothing extra. Managers (and admins) see
  // the card with an "Add event" CTA even on empty mosques.
  const [canAddEvent, session] = await Promise.all([
    canManageMosque(mosque.slug),
    getSiteSession(),
  ]);
  const canModerate = hasPermission(session?.permissions ?? [], "comments.moderate");
  const [following, liked] = session
    ? await Promise.all([
        isFollowingMosque(session.uid, mosque.slug),
        isLikingMosque(session.uid, mosque.slug),
      ])
    : [false, false];
  const analytics = canAddEvent ? await getMosqueAnalytics(mosque.slug) : undefined;
  const showClaim = (mosque.managers?.length ?? 0) === 0 && !canAddEvent;

  const published = mosque.status === "published";

  return (
    <div className="mx-auto max-w-[1340px] px-4 py-6">
      <MosqueCommunityHome
        mosque={mosque}
        locale={locale}
        view={parseView(viewParam)}
        baseHref={`/mosques/${mosque.slug}`}
        context={{
          signedIn: Boolean(session),
          currentUid: session?.uid ?? null,
          canManage: canAddEvent,
          canModerate,
        }}
        canonicalHref={`/mosques/${mosque.slug}`}
        topSlot={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/mosques"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" /> {t("back")}
            </Link>
            {published && mosque.shortCode && (
              <Link
                href={`/m/${mosque.shortCode}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent"
              >
                <ExternalLink className="size-4" /> {t("viewPublicPage")}
              </Link>
            )}
            {showClaim && (
              <Link
                href={`/mosques/apply?slug=${mosque.slug}`}
                className="ms-auto inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent/10"
              >
                {t("claimCta")}
                <span aria-hidden className="text-accent">→</span>
              </Link>
            )}
          </div>
        }
        followSlot={
          <MosqueFollowButton
            slug={mosque.slug}
            initialFollowing={following}
            initialCount={mosque.followerCount ?? 0}
            signedIn={Boolean(session)}
          />
        }
        likeSlot={
          <MosqueLikeButton
            slug={mosque.slug}
            initialLiked={liked}
            initialCount={mosque.likeCount ?? 0}
            signedIn={Boolean(session)}
          />
        }
        shareSlot={
          mosque.shortCode ? (
            <MosqueShareButton code={mosque.shortCode} name={localizedName} />
          ) : undefined
        }
        manageSlot={
          canAddEvent ? <MosqueManagePanel mosque={mosque} analytics={analytics} /> : undefined
        }
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mosqueJsonLd(mosque)) }}
      />
    </div>
  );
}
