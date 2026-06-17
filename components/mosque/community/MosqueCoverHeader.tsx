import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { pickLocalized } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
import { coverFallbackUrl } from "@/lib/mosques/cover-fallback";
import { Badge } from "@/components/ui/badge";
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
  manageSlot,
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
  manageSlot?: ReactNode;
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
      {/* Cover photo — uploaded, else a royalty-free fallback over the gradient. */}
      <div className="mq-cover-fallback relative h-44 overflow-hidden sm:h-60">
        <Image
          src={mosque.coverImage?.url ?? coverFallbackUrl(mosque.slug)}
          alt=""
          fill
          sizes="(min-width: 1024px) 920px, 100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-transparent" />
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic absolute start-5 top-4 text-2xl text-white/90 drop-shadow"
        >
          {ARABIC_GREETING}
        </p>
      </div>

      {/* Meta — the logo overlaps the cover (left); name/tags/stats sit beside it
          on the card, below the cover line, so they stay readable over any photo.
          `relative z-10` keeps the avatar above the absolutely-positioned image. */}
      <div className="relative z-10 px-5 pb-3">
        <div className="flex flex-wrap items-end gap-4">
          <div className="-mt-16 grid size-32 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-selected shadow">
            {mosque.logoUrl ? (
              <Image src={mosque.logoUrl} alt="" width={128} height={128} className="size-full object-cover" />
            ) : (
              <span className="font-display text-5xl text-accent">{initial}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl text-foreground sm:text-3xl">{name}</h1>
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
              {isVerified ? (
                <Badge variant="success">{tDetail("verified")}</Badge>
              ) : (
                <Badge variant="warning">{tDetail("unverified")}</Badge>
              )}
            </div>
            <div className="mt-2 flex gap-5">
              <div className="leading-tight">
                <span className="font-display text-lg text-foreground">{followers}</span>{" "}
                <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  {t("statFollowers")}
                </span>
              </div>
              <div className="leading-tight">
                <span className="font-display text-lg text-foreground">{posts}</span>{" "}
                <span className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
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

        {/* Sub-tabs (left) + actions kebab (right). The tabs scroll horizontally
            on narrow screens; overflow-y-hidden avoids a spurious vertical bar. */}
        <nav className="mt-4 flex items-center border-t border-border">
          <div className="flex flex-1 gap-1 overflow-x-auto overflow-y-hidden">
            <Link href={baseHref} className={`mq-tab${activeView === "posts" ? " active" : ""}`}>
              {t("tabPosts")}
            </Link>
            <Link href={`${baseHref}?view=about`} className={`mq-tab${activeView === "about" ? " active" : ""}`}>
              {t("tabAbout")}
            </Link>
            <Link href={`${baseHref}?view=events`} className={`mq-tab${activeView === "events" ? " active" : ""}`}>
              {t("tabEvents")}
            </Link>
            <Link href={`${baseHref}?view=duas`} className={`mq-tab${activeView === "duas" ? " active" : ""}`}>
              {t("tabDuas")}
            </Link>
          </div>
          {manageSlot && <div className="shrink-0 ps-2">{manageSlot}</div>}
        </nav>
      </div>
    </div>
  );
}
