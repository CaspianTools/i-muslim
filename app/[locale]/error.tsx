"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Segment-level error boundary for the whole localized app. Catches uncaught
 * render/runtime errors thrown below the [locale] layout and shows a branded,
 * recoverable fallback instead of Next's bare default error page. The layout
 * (and its NextIntlClientProvider) sits above this boundary, so translations
 * are available. Errors in the layout itself bubble to app/global-error.tsx.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>{t("retry")}</Button>
        <Button asChild variant="secondary">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
