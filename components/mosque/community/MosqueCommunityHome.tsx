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
import { VerseOfTheDayCard } from "./VerseOfTheDayCard";
import { PrayerCountdownCard } from "./PrayerCountdownCard";
import { DuaWall } from "./DuaWall";
import { MembersRail } from "./MembersRail";
import type { Mosque } from "@/types/mosque";

export type CommunityView = "posts" | "about" | "events" | "duas";

export interface CommunityContext {
  signedIn: boolean;
  currentUid: string | null;
  canManage: boolean;
  canModerate: boolean;
}

/**
 * Shared "community home" for both mosque surfaces. Renders a cover header with
 * Posts / About / Events tabs and the content for the active `view`. Posts is
 * the three-column home; About and Events are focused single-column subviews
 * (their own `?view=` URL). Page-specific chrome and client CTA buttons are
 * passed in as slots so this stays a server component.
 */
export async function MosqueCommunityHome({
  mosque,
  locale,
  view,
  baseHref,
  context,
  canonicalHref,
  topSlot,
  followSlot,
  likeSlot,
  installSlot,
  shareSlot,
  manageSlot,
}: {
  mosque: Mosque;
  locale: string;
  view: CommunityView;
  /** e.g. `/m/<code>` or `/mosques/<slug>` — tabs link off this. */
  baseHref: string;
  context: CommunityContext;
  canonicalHref: string;
  topSlot?: ReactNode;
  followSlot?: ReactNode;
  likeSlot?: ReactNode;
  installSlot?: ReactNode;
  shareSlot?: ReactNode;
  manageSlot?: ReactNode;
}) {
  const t = await getTranslations("mosques.community");
  const name = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;
  const showDiscussion = mosque.status === "published" || context.canManage;

  return (
    <div className="space-y-4 lg:space-y-5">
      {topSlot}

      <MosqueCoverHeader
        mosque={mosque}
        locale={locale}
        baseHref={baseHref}
        activeView={view}
        followSlot={followSlot}
        likeSlot={likeSlot}
        installSlot={installSlot}
        shareSlot={shareSlot}
        manageSlot={manageSlot}
      />

      {view === "about" && (
        <div className="mx-auto max-w-3xl space-y-4">
          <AboutSection mosque={mosque} locale={locale} />
        </div>
      )}

      {view === "events" && (
        <div className="mx-auto max-w-3xl">
          <MosqueEventsCard
            mosqueSlug={mosque.slug}
            canAddEvent={context.canManage}
            limit={50}
            showWhenEmpty
          />
        </div>
      )}

      {view === "duas" && (
        <div className="mx-auto max-w-5xl">
          <DuaWall
            slug={mosque.slug}
            signedIn={context.signedIn}
            currentUid={context.currentUid}
            canModerate={context.canModerate}
            variant="wall"
          />
        </div>
      )}

      {view === "posts" && (
        <>
        {/* On phones a masjid visitor wants prayer times first — surface the
            countdown above the feed; the rail keeps its desktop copy (below). */}
        <div className="lg:hidden">
          <PrayerCountdownCard mosque={mosque} locale={locale} />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px] lg:gap-5">
          {/* Left rail */}
          <aside className="order-3 space-y-4 lg:order-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pe-1">
            <VerseOfTheDayCard locale={locale} />
            <ContactRailCard mosque={mosque} />
          </aside>

          {/* Center feed */}
          <section className="order-1 space-y-4 lg:order-2">
            <MosqueNewsFeed
              slug={mosque.slug}
              mosqueName={name}
              locale={locale}
              signedIn={context.signedIn}
              currentUid={context.currentUid}
              canManage={context.canManage}
              canModerate={context.canModerate}
            />

            {showDiscussion && (
              <div className="mq-card mq-card-pad">
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
            <div className="hidden lg:block">
              <PrayerCountdownCard mosque={mosque} locale={locale} />
            </div>
            <MosqueEventsCard
              mosqueSlug={mosque.slug}
              canAddEvent={context.canManage}
              viewAllHref={`${baseHref}?view=events`}
            />
            <DuaWall
              slug={mosque.slug}
              signedIn={context.signedIn}
              currentUid={context.currentUid}
              canModerate={context.canModerate}
            />
            <MembersRail slug={mosque.slug} followerCount={mosque.followerCount ?? 0} />
          </aside>
        </div>
        </>
      )}
    </div>
  );
}
