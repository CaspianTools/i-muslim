"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  tr: "Türkçe",
  id: "Bahasa",
};

type LocaleSwitcherProps = {
  // When provided, only these locales appear in the dropdown. The current
  // locale is always included so users on a now-disabled URL can still switch
  // away. When undefined, falls back to the full LOCALES list.
  availableLocales?: readonly Locale[];
};

export function LocaleSwitcher({ availableLocales }: LocaleSwitcherProps = {}) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("footer");
  const [pending, startTransition] = useTransition();

  const visible: Locale[] = (() => {
    if (!availableLocales) return [...LOCALES];
    const set = new Set<Locale>(availableLocales);
    set.add(locale);
    return LOCALES.filter((l) => set.has(l));
  })();

  function switchLocale(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
        aria-label={t("language")}
        disabled={pending}
      >
        <Globe className="size-3.5" />
        <span>{LOCALE_LABEL[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {visible.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            className={l === locale ? "font-medium" : ""}
          >
            {LOCALE_LABEL[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
