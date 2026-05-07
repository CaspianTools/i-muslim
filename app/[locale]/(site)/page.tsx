import { Suspense } from "react";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeFeatures } from "@/components/home/HomeFeatures";
import { AyahOfTheDay } from "@/components/home/AyahOfTheDay";
import { HadithOfTheDay } from "@/components/home/HadithOfTheDay";
import { RecentMasjids } from "@/components/home/RecentMasjids";
import { RecentBusinesses } from "@/components/home/RecentBusinesses";
import { HomeEventsThisWeek } from "@/components/home/HomeEventsThisWeek";
import { HomeTools } from "@/components/home/HomeTools";

// Inline skeletons used as <Suspense fallback>. Each matches the visual
// shape of its corresponding async server component so the page doesn't
// jump on hydration. Uses the .skeleton recipe defined in globals.css.
function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
      <span className="skeleton skeleton-line w-1/3" />
      <span className="skeleton skeleton-line h-8 w-full" />
      <span className="skeleton skeleton-line w-2/3" />
      <span className="skeleton skeleton-line w-1/2" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-12">
      <span className="skeleton skeleton-line h-6 w-40" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="skeleton skeleton-card h-48" />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <HomeHero />

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <Suspense fallback={<CardSkeleton />}>
          <AyahOfTheDay />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <HadithOfTheDay />
        </Suspense>
      </div>

      <HomeFeatures />

      <Suspense fallback={<ListSkeleton />}>
        <RecentMasjids />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <RecentBusinesses />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <HomeEventsThisWeek />
      </Suspense>

      <HomeTools />
    </div>
  );
}
