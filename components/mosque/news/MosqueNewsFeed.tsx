import { getTranslations } from "next-intl/server";
import { listMosqueNews, getMyNewsReactions } from "@/lib/mosques/news";
import { MosqueNewsComposer } from "@/components/mosque/news/MosqueNewsComposer";
import { MosqueNewsItem } from "@/components/mosque/news/MosqueNewsItem";
import type { MosqueNewsMyReactions } from "@/types/mosque-news";

const NO_REACTIONS: MosqueNewsMyReactions = { amen: false, dua: false, heart: false };

/**
 * News feed for a masjid page (Facebook-style — one card per post). Server
 * component: fetches posts + the viewer's reaction state, renders the manager
 * composer (if allowed) and each post (which embeds the shared comment thread
 * via entityType `mosque_news`).
 */
export async function MosqueNewsFeed({
  slug,
  mosqueName,
  locale,
  signedIn,
  currentUid,
  canManage,
  canModerate,
}: {
  slug: string;
  mosqueName: string;
  locale: string;
  signedIn: boolean;
  currentUid: string | null;
  canManage: boolean;
  canModerate: boolean;
}) {
  const t = await getTranslations("mosques.news");
  const posts = await listMosqueNews(slug, { limit: 20 });
  const myReactions = currentUid
    ? await getMyNewsReactions(slug, currentUid, posts.map((p) => p.id))
    : new Map<string, MosqueNewsMyReactions>();
  const mosqueInitial = (mosqueName.trim()[0] ?? "M").toUpperCase();

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="mq-card">
          <MosqueNewsComposer slug={slug} />
        </div>
      )}
      {posts.length === 0 ? (
        <div className="mq-card mq-card-pad text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="mq-card">
            <MosqueNewsItem
              post={post}
              slug={slug}
              mosqueName={mosqueName}
              mosqueInitial={mosqueInitial}
              locale={locale}
              myReactions={myReactions.get(post.id) ?? NO_REACTIONS}
              signedIn={signedIn}
              canManage={canManage}
              canModerate={canModerate}
            />
          </div>
        ))
      )}
    </div>
  );
}
