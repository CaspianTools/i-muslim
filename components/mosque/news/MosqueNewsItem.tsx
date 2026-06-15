import { getTranslations } from "next-intl/server";
import { CommentThread } from "@/components/comments/CommentThread";
import { NewsPostActions } from "@/components/mosque/news/NewsPostActions";
import type { MosqueNewsPost } from "@/types/mosque-news";

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export async function MosqueNewsItem({
  post,
  slug,
  mosqueName,
  locale,
  liked,
  signedIn,
  canManage,
  canModerate,
}: {
  post: MosqueNewsPost;
  slug: string;
  mosqueName: string;
  locale: string;
  liked: boolean;
  signedIn: boolean;
  canManage: boolean;
  canModerate: boolean;
}) {
  const t = await getTranslations("mosques.news");
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <header className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{mosqueName}</span>
        <time className="text-xs text-muted-foreground" dateTime={post.createdAt}>
          {formatDate(post.createdAt, locale)}
        </time>
      </header>
      <p className="whitespace-pre-wrap text-sm text-foreground">{post.body}</p>
      {post.image?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image.url}
          alt=""
          className="mt-3 max-h-96 w-full rounded-lg border border-border object-cover"
        />
      )}
      <div className="mt-3 border-t border-border pt-3">
        <NewsPostActions
          slug={slug}
          postId={post.id}
          initialLiked={liked}
          initialLikeCount={post.likeCount}
          signedIn={signedIn}
          canManage={canManage}
          canModerate={canModerate}
        />
      </div>
      <div className="mt-2">
        <CommentThread
          entityType="mosque_news"
          entityId={`${slug}:${post.id}`}
          itemMeta={{
            title: t("commentItemTitle", { name: mosqueName }),
            href: `/mosques/${slug}`,
            locale,
          }}
          bare
        />
      </div>
    </article>
  );
}
