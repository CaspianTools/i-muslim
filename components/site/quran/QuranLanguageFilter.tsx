"use client";

import { useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ALL_LANGS,
  LANG_LABELS,
  parseLangsParam,
  serializeLangs,
  type LangCode,
} from "@/lib/translations";
import {
  SearchableMultiCombobox,
  type SearchableMultiComboboxOption,
} from "@/components/common/SearchableMultiCombobox";

const STORAGE_KEY = "i-muslim.langs";

interface QuranLanguageFilterProps {
  availableLangs: readonly LangCode[];
}

export function QuranLanguageFilter({ availableLangs }: QuranLanguageFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("quranLanguageFilter");

  const current = parseLangsParam(searchParams.get("lang"));
  const currentKey = current.join(",");

  const visible: LangCode[] = useMemo(() => {
    return ALL_LANGS.filter((l) => availableLangs.includes(l) || current.includes(l));
    // currentKey is a stable string fingerprint of `current`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableLangs, currentKey]);

  const options: SearchableMultiComboboxOption[] = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    return visible
      .map((code) => ({
        value: code,
        label: LANG_LABELS[code] ?? code.toUpperCase(),
      }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [visible, locale]);

  // First-mount hydration: if no ?lang= but localStorage has a saved value,
  // push it into the URL so the server rerenders with the user's preference.
  useEffect(() => {
    if (searchParams.get("lang")) return;
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = parseLangsParam(saved);
    if (parsed.length === 0) return;
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("lang", serializeLangs(parsed));
    router.replace(`${pathname}?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(next: string[]) {
    let chosen = next as LangCode[];
    // At least one language must remain selected; restore Arabic as the
    // sensible default for sacred text if user empties the selection.
    if (chosen.length === 0) chosen = ["ar"];
    const ordered = ALL_LANGS.filter((l) => chosen.includes(l));
    const serialized = serializeLangs(ordered);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    }
    const qs = new URLSearchParams(searchParams.toString());
    qs.set("lang", serialized);
    router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
  }

  return (
    <SearchableMultiCombobox
      options={options}
      value={current}
      onChange={handleChange}
      placeholder={t("placeholder")}
      searchPlaceholder={t("searchPlaceholder")}
      emptyText={t("noResults")}
      removeChipLabel={(name) => t("removeChip", { name })}
      moreText={(count) => t("moreItems", { count })}
      ariaLabel={t("label")}
    />
  );
}
