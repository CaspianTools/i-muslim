import { getTranslations } from "next-intl/server";
import { listMosqueDuas, getMyAminDuaIds } from "@/lib/mosques/duas";
import { DuaWallClient, type DuaVM } from "./DuaWallClient";

/**
 * Right-rail Du'a Wall: community prayer requests with "made du'a" counts.
 * Server component — fetches du'as + the viewer's amin state, hands an
 * interactive client list the rest.
 */
export async function DuaWall({
  slug,
  signedIn,
  currentUid,
  canModerate,
  variant = "rail",
}: {
  slug: string;
  signedIn: boolean;
  currentUid: string | null;
  canModerate: boolean;
  /** "rail" = compact right-rail card; "wall" = full-tab masonry. */
  variant?: "rail" | "wall";
}) {
  const t = await getTranslations("mosques.dua");
  // The full wall is the primary du'a surface, so pull more than the rail teaser.
  const duas = await listMosqueDuas(slug, { limit: variant === "wall" ? 60 : 12 });
  const myAmins = currentUid
    ? await getMyAminDuaIds(slug, currentUid, duas.map((d) => d.id))
    : new Set<string>();

  const vms: DuaVM[] = duas.map((d) => ({
    id: d.id,
    text: d.text,
    authorName: d.authorName,
    madeDuaCount: d.madeDuaCount,
    mine: myAmins.has(d.id),
  }));

  if (variant === "wall") {
    return (
      <div>
        <h2 className="font-display text-2xl text-foreground">{t("title")}</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
        <DuaWallClient
          slug={slug}
          signedIn={signedIn}
          canModerate={canModerate}
          initialDuas={vms}
          variant="wall"
        />
      </div>
    );
  }

  return (
    <div className="mq-card mq-card-pad">
      <div className="mq-rail-title">{t("title")}</div>
      <p className="mb-3 -mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      <DuaWallClient slug={slug} signedIn={signedIn} canModerate={canModerate} initialDuas={vms} />
    </div>
  );
}
