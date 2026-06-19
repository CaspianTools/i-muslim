"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { SubmitEventForm } from "@/components/site/events/SubmitEventForm";
import { getMosqueEventFormContext } from "@/app/[locale]/(site)/mosques/manage-actions";
import type { EventCategoryDoc } from "@/types/event-category";

interface FormCtx {
  categories: EventCategoryDoc[];
  userEmail: string;
}

/**
 * Embeds the public event-submission form inside the Manage popup's Events tab,
 * pre-locked to this masjid (the API re-verifies the manager before persisting).
 * The form context (categories + the manager's email) is lazy-loaded the first
 * time the tab is opened. On a successful submit the masjid page is refreshed
 * (so the new event shows) and the dialog closes.
 */
export function MosqueEventComposer({
  slug,
  mosqueName,
  active,
  onDone,
}: {
  slug: string;
  mosqueName: string;
  /** True while the Events tab is selected — gates the lazy context fetch. */
  active: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("mosques.events");
  const router = useRouter();
  const [ctx, setCtx] = useState<FormCtx | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active || ctx) return;
    let cancelled = false;
    (async () => {
      const res = await getMosqueEventFormContext(slug);
      if (cancelled) return;
      if (res.ok && res.categories) {
        setCtx({ categories: res.categories, userEmail: res.userEmail ?? "" });
      } else {
        setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, ctx, slug]);

  if (failed) {
    return <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>;
  }
  if (!ctx) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <SubmitEventForm
      userEmail={ctx.userEmail}
      categories={ctx.categories}
      lockedMosque={{ slug, name: mosqueName }}
      onSubmitted={() => {
        router.refresh();
        onDone();
      }}
    />
  );
}
