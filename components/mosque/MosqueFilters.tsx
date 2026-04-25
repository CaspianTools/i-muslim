"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DENOMINATIONS } from "@/lib/mosques/constants";
import type { Denomination } from "@/types/mosque";

interface Props {
  countries: Array<{ slug: string; name: string }>;
}

export function MosqueFilters({ countries }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const t = useTranslations("mosques");
  const tFilters = useTranslations("mosques.filters");
  const tDenominations = useTranslations("mosques.denominations");

  function update(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) params.delete(k);
      else params.set(k, v);
    }
    router.replace(`/mosques?${params.toString()}`, { scroll: false });
  }

  const q = sp.get("q") ?? "";
  const country = sp.get("country") ?? "";
  const denomination = (sp.get("denomination") ?? "") as Denomination | "";
  const hasFilters = Boolean(q || country || denomination || sp.get("near"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={t("searchAria")}
          placeholder={t("searchPlaceholder")}
          defaultValue={q}
          onChange={(e) => update({ q: e.target.value || undefined })}
          className="ps-8 w-72"
        />
      </div>
      <select
        aria-label={tFilters("country")}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={country}
        onChange={(e) => update({ country: e.target.value || undefined })}
      >
        <option value="">{tFilters("anyCountry")}</option>
        {countries.map((c) => (
          <option key={c.slug} value={c.slug.toUpperCase()}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label={tFilters("denomination")}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={denomination}
        onChange={(e) => update({ denomination: e.target.value || undefined })}
      >
        <option value="">{tFilters("anyDenomination")}</option>
        {DENOMINATIONS.map((d) => (
          <option key={d} value={d}>
            {tDenominations(d)}
          </option>
        ))}
      </select>
      {hasFilters && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.replace("/mosques", { scroll: false })}
        >
          <X /> {tFilters("clear")}
        </Button>
      )}
    </div>
  );
}
