import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PrayerTimesPanel, type PanelInit } from "@/components/prayer/PrayerTimesPanel";
import { MECCA_FALLBACK } from "@/lib/prayer/location";
import {
  pickDefaultMadhab,
  pickDefaultMethod,
} from "@/lib/prayer/methods";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("prayer");
  return {
    title: t("pageTitle"),
    description: t("pageSubtitleGeneric"),
  };
}

export default function PrayerTimesPage() {
  // Server-side fallback. The client island will run the auto-detect cascade
  // on mount (IP geolocation, timezone heuristic, or stored prefs) and
  // upgrade location accordingly. We render Mecca on the server so the HTML
  // contains real prayer times rather than placeholder dashes.
  const init: PanelInit = {
    coords: MECCA_FALLBACK.coords,
    method: pickDefaultMethod(MECCA_FALLBACK.countryCode),
    madhab: pickDefaultMadhab(MECCA_FALLBACK.countryCode),
    tz: MECCA_FALLBACK.tz,
    city: MECCA_FALLBACK.city,
    countryCode: MECCA_FALLBACK.countryCode,
    source: "fallback",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <PrayerTimesPanel initial={init} />
    </div>
  );
}
