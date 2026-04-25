"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ProfileCard } from "./ProfileCard";
import { Input } from "@/components/ui/input";
import type { MatrimonialProfile } from "@/types/matrimonial";

export function BrowseGrid({ candidates }: { candidates: MatrimonialProfile[] }) {
  const t = useTranslations("matrimonial.browse");
  const [country, setCountry] = useState("");
  const [madhhab, setMadhhab] = useState("");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");

  const countries = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.country))).sort(),
    [candidates],
  );

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (country && c.country !== country) return false;
      if (madhhab && c.madhhab !== madhhab) return false;
      const a = new Date(c.dateOfBirth);
      const age = Math.max(0, new Date().getFullYear() - a.getFullYear());
      if (ageMin && age < Number(ageMin)) return false;
      if (ageMax && age > Number(ageMax)) return false;
      return true;
    });
  }, [candidates, country, madhhab, ageMin, ageMax]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("subtitle", { count: filtered.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("filterCountry")}</div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("filterMadhhab")}</div>
            <select
              value={madhhab}
              onChange={(e) => setMadhhab(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {(["hanafi", "maliki", "shafii", "hanbali", "other", "none"] as const).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">{t("filterAge")}</div>
            <div className="flex gap-1">
              <Input
                type="number"
                placeholder="min"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className="w-16"
              />
              <Input
                type="number"
                placeholder="max"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className="w-16"
              />
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("noResults")}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
