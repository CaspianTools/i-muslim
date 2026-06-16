import type { ReactNode } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { pickLocalized } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
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
  followSlot,
  installSlot,
  shareSlot,
  hasPhotos,
}: {
  mosque: Mosque;
  locale: string;
  followSlot?: ReactNode;
  installSlot?: ReactNode;
  shareSlot?: ReactNode;
  hasPhotos: boolean;
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
      {/* Cover photo */}
      <div className="mq-cover-fallback relative h-44 sm:h-60">
        {mosque.coverImage?.url && (
          <Image
            src={mosque.coverImage.url}
            alt=""
            fill
            sizes="(min-width: 1024px) 920px, 100vw"
            className="object-cover"
            priority
          />
        )}
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic absolute start-5 top-4 text-2xl text-foreground/70 drop-shadow-sm"
        >
          {ARABIC_GREETING}
        </p>
      </div>

      {/* Meta row */}
      <div className="-mt-12 px-5 pb-2">
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-selected shadow">
            {mosque.logoUrl ? (
              <Image src={mosque.logoUrl} alt="" width={96} height={96} className="size-full object-cover" />
            ) : (
              <span className="font-display text-4xl text-accent">{initial}</span>
            )}
          </div>

          <div className="min-w-0 flex-1 pb-1">
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

          {(installSlot || followSlot || shareSlot) && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {installSlot}
              {followSlot}
              {shareSlot}
            </div>
          )}
        </div>

        {/* Sub-tabs */}
        <nav className="mt-4 flex gap-1 overflow-x-auto border-t border-border">
          <a href="#posts" className="mq-tab active">
            {t("tabPosts")}
          </a>
          <a href="#about" className="mq-tab">
            {t("tabAbout")}
          </a>
          <a href="#events" className="mq-tab">
            {t("tabEvents")}
          </a>
          {hasPhotos && (
            <a href="#photos" className="mq-tab">
              {t("tabPhotos")}
            </a>
          )}
        </nav>
      </div>
    </div>
  );
}
