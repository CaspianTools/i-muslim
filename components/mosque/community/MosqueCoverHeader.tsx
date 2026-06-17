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
 * Community-home cover header: cover photo (or token gradient) with an Arabic
 * greeting, an overlapping logo avatar, name + Arabic name + tags + stats, the
 * CTA slots (install / follow / share, passed in by the page), and the in-page
 * sub-tabs.
 */
export async function MosqueCoverHeader({
  mosque,
  locale,
  baseHref,
  activeView,
  followSlot,
  likeSlot,
  installSlot,
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
  installSlot?: ReactNode;
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
  const posts = mosque.newsCount ?? 0;

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
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="mt-0 grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-selected shadow sm:-mt-16 sm:size-32">
            {mosque.logoUrl ? (
              <Image src={mosque.logoUrl} alt="" width={128} height={128} className="size-full object-cover" />
            ) : (
              <span className="font-display text-4xl text-accent sm:text-5xl">{initial}</span>
            )}
          </div>

          <div className="min-w-0 flex-1 basis-full sm:basis-0">
            <h1 className="font-display text-xl text-foreground line-clamp-2 sm:text-3xl">
              {name}
              {isVerified && (
                <BadgeCheck
                  className="ms-1.5 inline size-5 shrink-0 align-[-0.15em] text-accent sm:size-6"
                  aria-label={tDetail("verified")}
                />
              )}
            </h1>
            {mosque.name.ar && locale !== "ar" && (
              <p dir="rtl" lang="ar" className="font-arabic text-xl text-accent">
                {mosque.name.ar}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{tDenom(mosque.denomination)}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {mosque.city}, {countryName(mosque.country)}
              </span>
            </div>
            <div className="mt-2 flex gap-5">
              <div className="leading-tight">
                <span className="font-display text-lg text-foreground">{followers}</span>{" "}
                <span className="text-[0.72rem] uppercase tracking-wide text-muted-foreground sm:text-[0.7rem]">
                  {t("statFollowers")}
                </span>
              </div>
              <div className="leading-tight">
                <span className="font-display text-lg text-foreground">{posts}</span>{" "}
                <span className="text-[0.72rem] uppercase tracking-wide text-muted-foreground sm:text-[0.7rem]">
                  {t("statPosts")}
                </span>
              </div>
            </div>
          </div>

          {(installSlot || followSlot || likeSlot || shareSlot) && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {followSlot}
              {likeSlot}
              {shareSlot}
              {installSlot}
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
