import { getTranslations } from "next-intl/server";
import { CommentThread } from "@/components/comments/CommentThread";
import { NewsPostActions } from "@/components/mosque/news/NewsPostActions";
import type { MosqueNewsPost, MosqueNewsMyReactions } from "@/types/mosque-news";

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
  mosqueInitial,
  locale,
  myReactions,
  signedIn,
  canManage,
  canModerate,
}: {
  post: MosqueNewsPost;
  slug: string;
  mosqueName: string;
  mosqueInitial: string;
  locale: string;
  myReactions: MosqueNewsMyReactions;
  signedIn: boolean;
  canManage: boolean;
  canModerate: boolean;
}) {
  const t = await getTranslations("mosques.news");
  return (
    <article className="p-5">
      <header className="mb-3 flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-selected font-display text-base text-accent">
          {mosqueInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{mosqueName}</p>
          <time className="text-xs text-muted-foreground" dateTime={post.createdAt}>
            {formatDate(post.createdAt, locale)}
          </time>
        </div>
      </header>
      <p className="whitespace-pre-wrap text-[0.925rem] leading-relaxed text-foreground">{post.body}</p>
      {post.image?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image.url}
          alt=""
          className="mt-3 max-h-96 w-full rounded-lg border border-border object-cover"
        />
      )}
      <div className="mt-3 border-t border-border pt-2">
        <NewsPostActions
          slug={slug}
          postId={post.id}
          initialCounts={post.reactionCounts}
          initialMine={myReactions}
          commentCount={post.commentCount}
          signedIn={signedIn}
          canManage={canManage}
          canModerate={canModerate}
        >
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
        </NewsPostActions>
      </div>
    </article>
  );
}
