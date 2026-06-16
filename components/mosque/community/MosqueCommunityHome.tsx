import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { pickLocalized } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
import { CommentThread } from "@/components/comments/CommentThread";
import { MosqueNewsFeed } from "@/components/mosque/news/MosqueNewsFeed";
import { MosqueEventsCard } from "@/components/mosque/MosqueEventsCard";
import { MosqueCoverHeader } from "./MosqueCoverHeader";
import { AboutSection } from "./AboutSection";
import { ContactRailCard } from "./ContactRailCard";
import { PhotosGrid } from "./PhotosGrid";
import { VerseOfTheDayCard } from "./VerseOfTheDayCard";
import { PrayerCountdownCard } from "./PrayerCountdownCard";
import { DuaWall } from "./DuaWall";
import { MembersRail } from "./MembersRail";
import type { Mosque } from "@/types/mosque";

export interface CommunityContext {
  signedIn: boolean;
  currentUid: string | null;
  canManage: boolean;
  canModerate: boolean;
}

/**
 * Shared "community home" layout for both mosque surfaces (the bare `/m/<code>`
 * page and the directory detail page). Renders a cover header + three-column
 * shell (left rail · center feed · right rail). Page-specific chrome and the
 * client CTA buttons are passed in as slots so this stays a server component.
 */
export async function MosqueCommunityHome({
  mosque,
  locale,
  context,
  canonicalHref,
  topSlot,
  followSlot,
  installSlot,
  shareSlot,
  manageSlot,
}: {
  mosque: Mosque;
  locale: string;
  context: CommunityContext;
  /** Canonical URL of this surface (for the discussion comment itemMeta). */
  canonicalHref: string;
  topSlot?: ReactNode;
  followSlot?: ReactNode;
  installSlot?: ReactNode;
  shareSlot?: ReactNode;
  manageSlot?: ReactNode;
}) {
  const t = await getTranslations("mosques.community");
  const name = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;
  const hasPhotos = (mosque.gallery ?? []).some((g) => g?.url);
  const showDiscussion = mosque.status === "published" || context.canManage;

  const railLink = "block rounded-md px-2 py-1.5 text-foreground hover:bg-muted";

  return (
    <div className="space-y-5">
      {topSlot}

      <MosqueCoverHeader
        mosque={mosque}
        locale={locale}
        followSlot={followSlot}
        installSlot={installSlot}
        shareSlot={shareSlot}
        hasPhotos={hasPhotos}
      />

      {manageSlot}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Left rail */}
        <aside className="order-3 space-y-4 lg:order-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pe-1">
          <VerseOfTheDayCard locale={locale} />
          <nav className="mq-card mq-card-pad">
            <div className="mq-rail-title">{t("onThisPage")}</div>
            <ul className="space-y-1 text-sm">
              <li><a href="#posts" className={railLink}>{t("tabPosts")}</a></li>
              <li><a href="#about" className={railLink}>{t("tabAbout")}</a></li>
              <li><a href="#events" className={railLink}>{t("tabEvents")}</a></li>
              {hasPhotos && <li><a href="#photos" className={railLink}>{t("tabPhotos")}</a></li>}
            </ul>
          </nav>
          <ContactRailCard mosque={mosque} />
        </aside>

        {/* Center feed */}
        <section className="order-1 space-y-4 lg:order-2">
          <div id="posts" className="scroll-mt-24">
            <MosqueNewsFeed
              slug={mosque.slug}
              mosqueName={name}
              locale={locale}
              signedIn={context.signedIn}
              currentUid={context.currentUid}
              canManage={context.canManage}
              canModerate={context.canModerate}
            />
          </div>

          <AboutSection mosque={mosque} locale={locale} />

          <PhotosGrid mosque={mosque} />

          {showDiscussion && (
            <div id="discussion" className="mq-card mq-card-pad scroll-mt-24">
              <h2 className="mq-rail-title">{t("discussion")}</h2>
              <CommentThread
                entityType="mosque"
                entityId={mosque.slug}
                itemMeta={{
                  title: name,
                  subtitle: `${mosque.city}, ${countryName(mosque.country)}`,
                  href: canonicalHref,
                  locale,
                }}
                bare
              />
            </div>
          )}
        </section>

        {/* Right rail */}
        <aside className="order-2 space-y-4 lg:order-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:ps-1">
          <PrayerCountdownCard mosque={mosque} locale={locale} />
          <div id="events" className="scroll-mt-24">
            <MosqueEventsCard mosqueSlug={mosque.slug} canAddEvent={context.canManage} />
          </div>
          <DuaWall
            slug={mosque.slug}
            signedIn={context.signedIn}
            currentUid={context.currentUid}
            canModerate={context.canModerate}
          />
          <MembersRail slug={mosque.slug} followerCount={mosque.followerCount ?? 0} />
        </aside>
      </div>
    </div>
  );
}
