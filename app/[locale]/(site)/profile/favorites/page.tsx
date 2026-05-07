import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChevronRight, Star } from "lucide-react";
import { getSiteSession } from "@/lib/auth/session";
import { listFavorites } from "@/lib/profile/data";
import { formatRelative } from "@/lib/utils";
import { RemoveFavoriteButton } from "@/components/site/profile/RemoveFavoriteButton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  FAVORITE_ITEM_TYPES,
  type FavoriteItemType,
  isFavoriteItemType,
} from "@/types/profile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("favorites");
  return { title: t("pageTitle") };
}

const TAB_KEYS: ReadonlyArray<"all" | FavoriteItemType> = [
  "all",
  ...FAVORITE_ITEM_TYPES,
];

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/profile/favorites");

  const sp = await searchParams;
  const activeType: FavoriteItemType | null = isFavoriteItemType(sp.type) ? sp.type : null;
  const t = await getTranslations("favorites");
  const tNav = await getTranslations("profileNav");

  const favorites = await listFavorites(session.uid, {
    itemType: activeType ?? undefined,
    limit: 100,
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {tNav("items.favorites")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {TAB_KEYS.map((key) => {
          const isActive =
            (activeType === null && key === "all") || activeType === key;
          const href =
            key === "all" ? "/profile/favorites" : `/profile/favorites?type=${key}`;
          return (
            <Link
              key={key}
              href={href}
              className={
                "inline-flex items-center rounded-md px-3 py-1.5 text-sm transition-colors " +
                (isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {t(`tabs.${key}` as `tabs.${typeof key}`)}
            </Link>
          );
        })}
      </nav>

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Star className="size-5" />}
          title={t("empty")}
          description={t("emptyHint")}
          actions={
            <Link
              href="/quran"
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {t("emptyCta")}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {favorites.map((fav) => (
            <li
              key={fav.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
            >
              {fav.itemMeta.thumbnail && (
                <img
                  src={fav.itemMeta.thumbnail}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t(`tabs.${fav.itemType}` as `tabs.${FavoriteItemType}`)}
                    </span>
                    <h2 className="mt-0.5 truncate text-base font-medium text-foreground">
                      {fav.itemMeta.title}
                    </h2>
                  </div>
                  <RemoveFavoriteButton favoriteId={fav.id} />
                </div>
                {fav.itemMeta.subtitle && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {fav.itemMeta.subtitle}
                  </p>
                )}
                {fav.itemMeta.arabic && (
                  <p
                    dir="rtl"
                    lang="ar"
                    className="mt-2 line-clamp-1 font-arabic text-base text-foreground/80"
                  >
                    {fav.itemMeta.arabic}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatRelative(fav.createdAt)}</span>
                  <Link
                    href={fav.itemMeta.href}
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    {t("open")}
                    <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
