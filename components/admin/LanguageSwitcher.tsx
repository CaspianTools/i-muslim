"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config";

const FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  ar: "🇸🇦",
  tr: "🇹🇷",
  id: "🇮🇩",
};

function persistLocaleCookie(code: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function LanguageSwitcher() {
  const current = useLocale() as Locale;
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function select(code: Locale) {
    if (code === current) return;
    persistLocaleCookie(code);
    // next-intl pathname is locale-less; replace with the same path under the
    // selected locale so the URL prefix updates.
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("header.languageLabel", { label: t(`locale.${current}`) })}
          aria-busy={isPending}
        >
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuLabel>{t("header.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((code) => (
          <DropdownMenuItem key={code} onClick={() => select(code)}>
            <span aria-hidden className="text-base leading-none">{FLAGS[code]}</span>
            <span>{t(`locale.${code}`)}</span>
            {current === code && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
