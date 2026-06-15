import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSiteSession } from "@/lib/auth/session";
import { listFollowedSlugs } from "@/lib/mosques/follows";
import { listMosqueNews } from "@/lib/mosques/news";
import { fetchMosqueBySlug } from "@/lib/admin/data/mosques";
import { pickLocalized } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mosques.follow");
  return { title: t("feedTitle"), robots: { index: false } };
}

export default async function FollowingFeedPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/mosques/following");

  const [t, locale] = await Promise.all([getTranslations("mosques.follow"), getLocale()]);
  const slugs = await listFollowedSlugs(session.uid);

  const grouped = await Promise.all(
    slugs.map(async (slug) => {
      const [{ mosque }, posts] = await Promise.all([
        fetchMosqueBySlug(slug),
        listMosqueNews(slug, { limit: 5 }),
      ]);
      if (!mosque || mosque.status !== "published") return [];
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
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.image.url} alt="" className="mt-3 max-h-80 w-full rounded-lg border border-border object-cover" />
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
