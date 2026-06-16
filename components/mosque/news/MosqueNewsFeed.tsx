import { getTranslations } from "next-intl/server";
import { listMosqueNews, getLikedPostIds } from "@/lib/mosques/news";
import { MosqueNewsComposer } from "@/components/mosque/news/MosqueNewsComposer";
import { MosqueNewsItem } from "@/components/mosque/news/MosqueNewsItem";

/**
 * News feed for a masjid page. Server component: fetches posts + the viewer's
 * like state, renders the manager composer (if allowed) and each post (which in
 * turn embeds the shared comment thread via entityType `mosque_news`).
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
  const likedSet = currentUid
    ? await getLikedPostIds(slug, currentUid, posts.map((p) => p.id))
    : new Set<string>();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("heading")}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {canManage && <MosqueNewsComposer slug={slug} />}
        {posts.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          posts.map((post) => (
            <MosqueNewsItem
              key={post.id}
              post={post}
              slug={slug}
              mosqueName={mosqueName}
              locale={locale}
              liked={likedSet.has(post.id)}
              signedIn={signedIn}
              canManage={canManage}
              canModerate={canModerate}
            />
          ))
        )}
      </div>
    </section>
  );
}
