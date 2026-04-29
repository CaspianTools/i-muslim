"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { removeFavoriteAction } from "@/app/[locale]/(site)/profile/actions";

interface Props {
  favoriteId: string;
}

export function RemoveFavoriteButton({ favoriteId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const t = useTranslations("favorites");

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await removeFavoriteAction(favoriteId);
        if (!result.ok) {
          toast.error(t("saveFailed"));
          return;
        }
        toast.success(t("removedToast"));
        router.refresh();
      } catch {
        toast.error(t("saveFailed"));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={t("remove")}
      title={t("remove")}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
