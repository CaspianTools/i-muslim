"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  TAFSIR_PARAM,
  defaultTafsirPreference,
  parseTafsirParam,
  type TafsirPreference,
} from "@/lib/tafsir/preference";
import { cn } from "@/lib/utils";

/**
 * Which commentary appears under each ayah, or none at all.
 *
 * A separate control from QuranLanguageFilter on purpose: that one picks Quran
 * *translations* (ar/en/ru/az/tr), this one picks a *commentary edition*
 * (ar/id). The two sets genuinely differ — there is no Indonesian Quran
 * translation and no English tafsir — so sharing one `?lang=` would offer
 * combinations that don't exist.
 *
 * State lives in the URL rather than localStorage, so the server render is
 * already correct and there is no first-paint flash of the wrong language. The
 * surah page carries the param through pagination.
 */
export function TafsirLanguageFilter({
  options,
}: {
  /** Renderable tafsir languages, from the licensing catalog. */
  options: readonly ("ar" | "id")[];
}) {
  const t = useTranslations("tafsir");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = parseTafsirParam(searchParams.get(TAFSIR_PARAM), locale);

  const choose = (next: TafsirPreference) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === defaultTafsirPreference(locale)) params.delete(TAFSIR_PARAM);
    else params.set(TAFSIR_PARAM, next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const choices: Array<{ value: TafsirPreference; label: string }> = [
    ...options.map((lang) => ({
      value: lang as TafsirPreference,
      label: lang === "ar" ? t("languageArabic") : t("languageIndonesian"),
    })),
    { value: "off", label: t("offLabel") },
  ];

  return (
    <div role="radiogroup" aria-label={t("filterLabel")} className="flex flex-wrap gap-1.5">
      {choices.map((choice) => {
        const active = current === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(choice.value)}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-2.5 text-xs transition-colors",
              active ? "ui-selected-chip" : "ui-selected-chip-idle",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
