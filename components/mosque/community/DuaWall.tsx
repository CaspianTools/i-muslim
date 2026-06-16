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
}: {
  slug: string;
  signedIn: boolean;
  currentUid: string | null;
  canModerate: boolean;
}) {
  const t = await getTranslations("mosques.dua");
  const duas = await listMosqueDuas(slug, { limit: 12 });
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

  return (
    <div className="mq-card mq-card-pad">
      <div className="mq-rail-title">{t("title")}</div>
      <p className="mb-3 -mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      <DuaWallClient slug={slug} signedIn={signedIn} canModerate={canModerate} initialDuas={vms} />
    </div>
  );
}
