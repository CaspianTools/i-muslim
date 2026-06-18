import type { ReactNode } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { BadgeCheck, MapPin } from "lucide-react";
import { pickLocalized } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
import { coverFallbackUrl } from "@/lib/mosques/cover-fallback";
import { MosqueNav } from "./MosqueNav";
import type { Mosque } from "@/types/mosque";

const ARABIC_GREETING = "السَّلَامُ عَلَيْكُمْ";

/**
 * Community-home cover header: a cover photo (shown ≥sm) with an Arabic greeting,
 * the logo avatar + name (with a verified check) + tags + a single followers
 * count, the borderless CTA slots (follow / like / share, passed in by the page),
 * and the in-page sub-navigation. Install lives in the bottom banner
 * (MasjidInstallPrompt) and the nav drawer, not the header.
 */
export async function MosqueCoverHeader({
  mosque,
  locale,
  baseHref,
  activeView,
  followSlot,
  likeSlot,
  shareSlot,
  analytics,
  canManage,
}: {
  mosque: Mosque;
  locale: string;
  /** e.g. `/m/<code>` or `/mosques/<slug>` — tabs link off this. */
  baseHref: string;
  activeView: "posts" | "about" | "events" | "duas";
  followSlot?: ReactNode;
  likeSlot?: ReactNode;
  shareSlot?: ReactNode;
  analytics?: { views: number; scans: number };
  canManage?: boolean;
}) {
  const t = await getTranslations("mosques.community");
  const tDenom = await getTranslations("mosques.denominations");
  const tDetail = await getTranslations("mosques.detail");

  const name = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;
  const initial = (name.trim()[0] ?? "M").toUpperCase();
  const isVerified = Boolean(mosque.moderation?.reviewedAt);
  const followers = mosque.followerCount ?? 0;

  return (
    <div className="mq-card">
      {/* Cover photo — uploaded, else a royalty-free fallback over the gradient.
          Hidden on phones (the header opens straight at the logo/name). */}
      <div className="mq-cover-fallback relative hidden h-60 overflow-hidden sm:block">
        <Image
          src={mosque.coverImage?.url ?? coverFallbackUrl(mosque.slug)}
          alt=""
          fill
          sizes="(min-width: 1024px) 920px, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-transparent" />
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic absolute start-4 top-3 text-2xl text-white/90 drop-shadow sm:start-5 sm:top-4"
        >
          {ARABIC_GREETING}
        </p>
      </div>

      {/* Meta — the logo overlaps the cover (left); name/tags/stats sit beside it
          on the card, below the cover line, so they stay readable over any photo.
          `relative z-10` keeps the avatar above the absolutely-positioned image. */}
      <div className="relative z-10 px-4 pb-3 pt-4 sm:px-5 sm:pt-0">
        {/* Row A: logo + name & meta on one line (beside the logo at every size). */}
        <div className="flex items-center gap-4 sm:items-end">
          <div className="mt-0 grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-selected shadow sm:-mt-16 sm:size-32">
            {mosque.logoUrl ? (
              <Image src={mosque.logoUrl} alt="" width={128} height={128} className="size-full object-cover" />
            ) : (
              <span className="font-display text-4xl text-accent sm:text-5xl">{initial}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="flex items-start gap-1.5 font-display text-xl text-foreground sm:text-3xl">
              <span className="line-clamp-2 min-w-0">{name}</span>
              {isVerified && (
                <BadgeCheck
                  className="mt-1 size-5 shrink-0 text-accent sm:mt-1.5 sm:size-6"
                  aria-label={tDetail("verified")}
                />
              )}
            </h1>
            {mosque.name.ar && locale !== "ar" && (
              <p dir="rtl" lang="ar" className="font-arabic text-xl text-accent line-clamp-1">
                {mosque.name.ar}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{tDenom(mosque.denomination)}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {mosque.city}, {countryName(mosque.country)}
              </span>
            </div>
          </div>
        </div>

        {/* Row B: follower count + the action icons (borderless, blended in). */}
        <div className="mt-3 flex items-center justify-between gap-3 sm:justify-start sm:gap-4">
          <div className="leading-tight">
            <span className="font-display text-lg text-foreground">{followers}</span>{" "}
            <span className="text-[0.72rem] uppercase tracking-wide text-muted-foreground sm:text-[0.7rem]">
              {t("statFollowers")}
            </span>
          </div>
          {(followSlot || likeSlot || shareSlot) && (
            <div className="flex items-center gap-1">
              {followSlot}
              {likeSlot}
              {shareSlot}
            </div>
          )}
        </div>

        {/* Sub-navigation: desktop tab strip + manage kebab; phones collapse to
            the active view's name + a hamburger that opens a bottom drawer. */}
        <MosqueNav
          activeView={activeView}
          items={[
            { key: "posts", label: t("tabPosts"), href: baseHref },
            { key: "about", label: t("tabAbout"), href: `${baseHref}?view=about` },
            { key: "events", label: t("tabEvents"), href: `${baseHref}?view=events` },
            { key: "duas", label: t("tabDuas"), href: `${baseHref}?view=duas` },
          ]}
          mosque={mosque}
          analytics={analytics}
          canManage={Boolean(canManage)}
        />
      </div>
    </div>
  );
}
