"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Heart } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { toggleFavoriteAction } from "@/app/[locale]/(site)/profile/actions";
import { useFavoritesContext } from "@/components/site/favorites/FavoritesContext";
import type { FavoriteItemMeta, FavoriteItemType } from "@/types/profile";
import { cn } from "@/lib/utils";

interface Props {
  itemType: FavoriteItemType;
  itemId: string;
  itemMeta: FavoriteItemMeta;
  initialFavorited?: boolean;
  variant?: "heart" | "bookmark";
  size?: "sm" | "md";
  className?: string;
  /**
   * Hide the label and only show the icon. Defaults to false.
   */
  iconOnly?: boolean;
  /**
   * Server-known auth state from `getSiteSession()`. The button uses this as
   * the sole signal for whether to gate the click — the toggle action itself
   * authenticates via the same `__session` cookie, so we never need a
   * Firebase client ID token.
   */
  signedIn?: boolean;
}

export function FavoriteButton({
  itemType,
  itemId,
  itemMeta,
  initialFavorited = false,
  variant = "heart",
  size = "sm",
  className,
  iconOnly = false,
  signedIn = false,
}: Props) {
  const ctx = useFavoritesContext();
  const ctxFavorited = ctx?.has(itemType, itemId);
  const [localFavorited, setLocalFavorited] = useState<boolean>(initialFavorited);
  const favorited = ctxFavorited ?? localFavorited;
  const [pending, startTransition] = useTransition();
  const t = useTranslations("favorites");

  const Icon = variant === "bookmark" ? Bookmark : Heart;

  function handleAnonClick() {
    toast.error(t("signInRequired"), {
      action: {
        label: t("signInCta"),
        onClick: () => {
          window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
        },
      },
    });
  }

  function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!signedIn) {
      handleAnonClick();
      return;
    }

    const previous = favorited;
    const next = !favorited;
    setLocalFavorited(next);
    ctx?.set(itemType, itemId, next);

    startTransition(async () => {
      try {
        const result = await toggleFavoriteAction({ itemType, itemId, itemMeta });
        if (!result.ok) {
          setLocalFavorited(previous);
          ctx?.set(itemType, itemId, previous);
          if (result.reason === "unauthorized") {
            handleAnonClick();
          } else {
            toast.error(t("saveFailed"));
          }
          return;
        }
        if (result.favorited !== next) {
          setLocalFavorited(result.favorited);
          ctx?.set(itemType, itemId, result.favorited);
        }
        toast.success(result.favorited ? t("savedToast") : t("removedToast"));
      } catch {
        setLocalFavorited(previous);
        ctx?.set(itemType, itemId, previous);
        toast.error(t("saveFailed"));
      }
    });
  }

  const label =
    variant === "bookmark"
      ? favorited
        ? t("matrimonial.saved")
        : t("matrimonial.save")
      : favorited
        ? t("saved")
        : t("save");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border transition-colors",
        size === "sm" ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm",
        favorited
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      )}
    >
      <Icon className={cn("size-4", favorited && "fill-current")} />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

