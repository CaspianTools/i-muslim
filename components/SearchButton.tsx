"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SearchButton() {
  const t = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Radix Dialog auto-focuses first focusable; explicit focus after a tick
      // ensures the cursor lands in the input on every open.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (new FormData(form).get("q") as string | null)?.trim() ?? "";
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        aria-label={t("search")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Search className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("searchTitle")}</DialogTitle>
          <DialogDescription>{t("searchDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} role="search">
          <label htmlFor="site-search-dialog" className="sr-only">
            {t("searchPlaceholder")}
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={inputRef}
              id="site-search-dialog"
              name="q"
              type="search"
              placeholder={t("searchPlaceholder")}
              defaultValue={initial}
              className="w-full rounded-md border border-border bg-background px-3 py-2 pl-9 text-sm placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("searchHint")}</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
