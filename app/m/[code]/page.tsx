import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { pickLocalized } from "@/lib/utils";
import { fetchMosqueByShortCode } from "@/lib/admin/data/mosques";
import { countryName } from "@/lib/mosques/countries";
import { mosqueJsonLd } from "@/lib/mosques/jsonld";
import { getSiteUrl } from "@/lib/mosques/constants";
import { MosqueCommunityHome } from "@/components/mosque/community/MosqueCommunityHome";
import { MosqueActionsMenu } from "@/components/mosque/community/MosqueActionsMenu";
import { MosqueFollowButton } from "@/components/mosque/MosqueFollowButton";
import { MosqueLikeButton } from "@/components/mosque/MosqueLikeButton";
import { InstallMasjidButton } from "@/components/mosque/InstallMasjidButton";
import { MosqueShareButton } from "@/components/mosque/community/MosqueShareButton";
import { MasjidViewTracker } from "@/components/mosque/MasjidViewTracker";
import { canManageMosque } from "@/lib/mosques/authz";
import { getSiteSession } from "@/lib/auth/session";
import { isFollowingMosque } from "@/lib/mosques/follows";
import { isLikingMosque } from "@/lib/mosques/likes";
import { getMosqueAnalytics } from "@/lib/mosques/analytics";
import { hasPermission } from "@/lib/permissions/check";

// Live content (news, Iqamah, manager edits) must not be statically cached.
export const dynamic = "force-dynamic";

/** A masjid is publicly visible at `/m/<code>` only when published; a manager
 *  (or admin) may preview their own draft. */
async function resolveVisibleMosque(code: string) {
  const { mosque } = await fetchMosqueByShortCode(code);
  if (!mosque) return null;
  if (mosque.status === "published") return { mosque, isDraftPreview: false };
  const canManage = await canManageMosque(mosque.slug);
  if (!canManage) return null;
  return { mosque, isDraftPreview: true };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const { mosque } = await fetchMosqueByShortCode(code);
  if (!mosque || mosque.status !== "published") return { robots: { index: false } };
  const title = `${mosque.name.en} — ${mosque.city}, ${countryName(mosque.country)}`;
  const description =
    mosque.about ??
    mosque.description?.en ??
    `News, events, and prayer times for ${mosque.name.en} in ${mosque.city}.`;
  return {
    title,
    description,
    // Per-masjid PWA: override the site-wide manifest so this page installs as
    // its own standalone app (masjid name + logo, launching into /m/<code>).
    manifest: `/m/${code}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: mosque.name.en, statusBarStyle: "default" },
    icons: { apple: `/m/${code}/app-icon?size=192` },
    alternates: { canonical: `${getSiteUrl()}/m/${code}` },
    openGraph: {
      title,
      description,
      url: `${getSiteUrl()}/m/${code}`,
      images: mosque.coverImage?.url ? [{ url: mosque.coverImage.url }] : undefined,
      type: "website",
    },
  };
}

function parseView(v: string | undefined): "posts" | "about" | "events" | "duas" {
  return v === "about" ? "about" : v === "events" ? "events" : v === "duas" ? "duas" : "posts";
}

export default async function MasjidShortLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ code }, { view: viewParam }] = await Promise.all([params, searchParams]);
  const [resolved, locale] = await Promise.all([resolveVisibleMosque(code), getLocale()]);
  if (!resolved) notFound();
  const { mosque, isDraftPreview } = resolved;
  const t = await getTranslations("mosques.detail");

  const localizedName = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;
  const [canManage, session] = await Promise.all([
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
  const analytics = canManage ? await getMosqueAnalytics(mosque.slug) : undefined;

  const published = mosque.status === "published";

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-[1340px] px-4 py-6">
        <MosqueCommunityHome
          mosque={mosque}
          locale={locale}
          view={parseView(viewParam)}
          baseHref={`/m/${code}`}
          context={{
            signedIn: Boolean(session),
            currentUid: session?.uid ?? null,
            canManage,
            canModerate,
          }}
          canonicalHref={`/m/${code}`}
          topSlot={
            <>
              {isDraftPreview && (
                <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
                  {t("draftPreviewNote")}
                </div>
              )}
              {published && <MasjidViewTracker slug={mosque.slug} />}
            </>
          }
          installSlot={published ? <InstallMasjidButton /> : undefined}
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
          shareSlot={<MosqueShareButton code={code} name={localizedName} />}
          manageSlot={
            canManage ? <MosqueActionsMenu mosque={mosque} analytics={analytics} /> : undefined
          }
        />

        {published && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(mosqueJsonLd(mosque)) }}
          />
        )}
      </div>
    </main>
  );
}
