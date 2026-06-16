import { getTranslations } from "next-intl/server";
import { listRecentFollowers } from "@/lib/mosques/follows";

/**
 * Right-rail "Community" card showing recent followers (not live presence).
 * Renders nothing when there are no followers and the rail would be empty.
 */
export async function MembersRail({
  slug,
  followerCount,
}: {
  slug: string;
  followerCount: number;
}) {
  const t = await getTranslations("mosques.community");
  const members = await listRecentFollowers(slug, 8);

  return (
    <div className="mq-card mq-card-pad">
      <div className="mq-rail-title">
        <span>{t("membersTitle")}</span>
        {followerCount > 0 && (
          <span className="font-sans text-xs font-normal text-muted-foreground">
            {t("membersCount", { count: followerCount })}
          </span>
        )}
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("membersEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const initial = (m.name.trim()[0] ?? "·").toUpperCase();
            return (
              <li key={m.uid} className="flex items-center gap-2.5">
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-selected font-display text-sm text-accent">
                    {initial}
                  </span>
                )}
                <span className="truncate text-sm text-foreground">{m.name || t("member")}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
