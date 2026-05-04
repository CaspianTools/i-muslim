"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  BusinessAmenity,
  BusinessCategory,
  HalalStatus,
  PriceTier,
} from "@/types/business";
import type { Locale } from "@/i18n/config";
import { pickLocalized } from "@/lib/utils";

interface Props {
  categories: BusinessCategory[];
  amenities: BusinessAmenity[];
  total: number;
}

export function BusinessFilters({ categories, amenities, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useTranslations("businesses.filters");
  const tHalal = useTranslations("businesses.halalStatuses");
  const tPrice = useTranslations("businesses.priceTiers");
  const tCommon = useTranslations("businesses");
  const locale = useLocale() as Locale;

  const q = params.get("q") ?? "";
  const cat = params.get("category") ?? "";
  const halal = (params.get("halal") ?? "") as HalalStatus | "";
  const amenity = params.get("amenity") ?? "";
  const price = params.get("price") ?? "";

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`);
  }

  function clearAll() {
    router.replace(pathname);
  }

  const hasActive = q || cat || halal || amenity || price;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64 md:w-72">
          <Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            defaultValue={q}
            onChange={(e) => update({ q: e.target.value || undefined })}
            placeholder={tCommon("publicSearchPlaceholder")}
            className="ps-8"
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={cat}
          onChange={(e) => update({ category: e.target.value || undefined })}
          aria-label={t("category")}
        >
          <option value="">{tCommon("publicAllCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{pickLocalized(c.name, locale, "en") ?? c.name.en}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={halal}
          onChange={(e) => update({ halal: e.target.value || undefined })}
          aria-label={t("halal")}
        >
          <option value="">{tHalal("all")}</option>
          {(["certified", "self_declared", "muslim_owned"] as HalalStatus[]).map((s) => (
            <option key={s} value={s}>{tHalal(s)}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={amenity}
          onChange={(e) => update({ amenity: e.target.value || undefined })}
          aria-label={t("amenity")}
        >
          <option value="">{t("amenity")}</option>
          {amenities.map((a) => (
            <option key={a.id} value={a.id}>{pickLocalized(a.name, locale, "en") ?? a.name.en}</option>
          ))}
        </select>
        <select
          className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={price}
          onChange={(e) => update({ price: e.target.value || undefined })}
          aria-label={t("price")}
        >
          <option value="">{tPrice("any")}</option>
          {([1, 2, 3, 4] as PriceTier[]).map((p) => (
            <option key={p} value={String(p)}>{tPrice(String(p))}</option>
          ))}
        </select>
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            {t("clear")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{total} listings</p>
    </div>
  );
}
