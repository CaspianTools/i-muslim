import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSession } from "@/lib/auth/session";
import { listFollowedSlugs } from "@/lib/mosques/follows";
import { listMosqueNews } from "@/lib/mosques/news";
import { fetchPublishedMosques } from "@/lib/admin/data/mosques";
import { pickLocalized } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosques.follow");
  return { title: t("feedTitle"), robots: { index: false, follow: false } };
}

export default async function FollowingFeedPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/mosques/following");

  const [t, tNews, locale, slugs, { mosques: published }] = await Promise.all([
    getTranslations("mosques.follow"),
    getTranslations("mosques.news"),
    getLocale(),
    listFollowedSlugs(session.uid),
    // Reuse the cross-request-cached published set instead of a per-slug
    // fetchMosqueBySlug read for each followed mosque (was the N in the N+1).
    fetchPublishedMosques(),
  ]);
  const bySlug = new Map(published.map((m) => [m.slug, m]));

  // Only the news query remains per-followed-mosque; bounded by follow count.
  const grouped = await Promise.all(
    slugs.map(async (slug) => {
      const mosque = bySlug.get(slug);
      if (!mosque) return [];
      const posts = await listMosqueNews(slug, { limit: 5 });
      const name = pickLocalized(mosque.name, locale, "en") ?? mosque.name.en;
      const href = mosque.shortCode ? `/m/${mosque.shortCode}` : `/mosques/${mosque.slug}`;
      return posts.map((post) => ({ post, name, href }));
    }),
  );

  const feed = grouped
    .flat()
    .sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt))
    .slice(0, 50);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("feedTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("feedSubtitle")}</p>
      </header>

      {feed.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("feedEmpty")}</p>
          <Link href="/mosques" className="mt-3 inline-block text-sm text-accent hover:underline">
            {t("browseMasjids")}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {feed.map(({ post, name, href }) => (
            <li key={post.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-2">
                <Link href={href} className="text-sm font-semibold text-foreground hover:text-accent">
                  {name}
                </Link>
                <time className="text-xs text-muted-foreground" dateTime={post.createdAt}>
                  {new Date(post.createdAt).toLocaleDateString(locale)}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{post.body}</p>
              {post.image?.url && (
                <div className="relative mt-3 aspect-[16/10] w-full overflow-hidden rounded-lg border border-border">
                  <Image
                    src={post.image.url}
                    alt={tNews("imageAlt", { mosque: name })}
                    fill
                    sizes="(max-width: 640px) 100vw, 640px"
                    className="object-cover"
                  />
                </div>
              )}
              <Link href={href} className="mt-3 inline-block text-xs text-accent hover:underline">
                {t("viewMasjid")} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
