"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { LanguageCombobox } from "@/components/common/LanguageCombobox";
import { DENOMINATIONS } from "@/lib/mosques/constants";
import type { Denomination } from "@/types/mosque";

interface FormState {
  nameEn: string;
  nameAr: string;
  addressLine1: string;
  city: string;
  country: string;
  denomination: Denomination;
  phone: string;
  website: string;
  email: string;
  description: string;
  submitterEmail: string;
  languages: string[];
  // honeypot
  website_url_secondary: string;
}

const empty: FormState = {
  nameEn: "",
  nameAr: "",
  addressLine1: "",
  city: "",
  country: "",
  denomination: "unspecified",
  phone: "",
  website: "",
  email: "",
  description: "",
  submitterEmail: "",
  languages: [],
  website_url_secondary: "",
};

export function SubmitMosqueForm() {
  const t = useTranslations("mosques.submit");
  const tDenominations = useTranslations("mosques.denominations");
  const [state, setState] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!state.nameEn.trim()) next.nameEn = t("validation.nameRequired");
    if (!state.addressLine1.trim()) next.addressLine1 = t("validation.addressRequired");
    if (!state.city.trim()) next.city = t("validation.cityRequired");
    if (!/^[A-Za-z]{2}$/.test(state.country.trim())) next.country = t("validation.countryRequired");
    if (!state.submitterEmail.trim() || !/^.+@.+\..+$/.test(state.submitterEmail.trim()))
      next.submitterEmail = t("validation.submitterEmailRequired");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/mosques/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 429) {
        toast.error(t("errorRate"));
        return;
      }
      if (res.status === 403 && data.error === "turnstile") {
        toast.error(t("errorTurnstile"));
        return;
      }
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? t("errorGeneric"));
        return;
      }
      toast.success(t("success"));
      setState(empty);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-base font-medium text-foreground">{t("success")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* honeypot */}
      <input
        type="text"
        name="website_url_secondary"
        autoComplete="off"
        tabIndex={-1}
        className="hidden"
        value={state.website_url_secondary}
        onChange={(e) => setState((s) => ({ ...s, website_url_secondary: e.target.value }))}
      />

      <div className="space-y-1.5">
        <Label htmlFor="sub-name-en">{t("fields.nameEn")}</Label>
        <Input
          id="sub-name-en"
          value={state.nameEn}
          onChange={(e) => setState((s) => ({ ...s, nameEn: e.target.value }))}
        />
        {errors.nameEn && <p className="text-xs text-danger">{errors.nameEn}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-name-ar">{t("fields.nameAr")}</Label>
        <Input
          id="sub-name-ar"
          dir="rtl"
          lang="ar"
          className="font-arabic"
          value={state.nameAr}
          onChange={(e) => setState((s) => ({ ...s, nameAr: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-address">{t("fields.addressLine1")}</Label>
        <Input
          id="sub-address"
          value={state.addressLine1}
          onChange={(e) => setState((s) => ({ ...s, addressLine1: e.target.value }))}
        />
        {errors.addressLine1 && <p className="text-xs text-danger">{errors.addressLine1}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sub-city">{t("fields.city")}</Label>
          <Input
            id="sub-city"
            value={state.city}
            onChange={(e) => setState((s) => ({ ...s, city: e.target.value }))}
          />
          {errors.city && <p className="text-xs text-danger">{errors.city}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-country">{t("fields.country")}</Label>
          <CountryCombobox
            id="sub-country"
            value={state.country}
            onChange={(code) => setState((s) => ({ ...s, country: code }))}
          />
          {errors.country && <p className="text-xs text-danger">{errors.country}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-denom">{t("fields.denomination")}</Label>
        <select
          id="sub-denom"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={state.denomination}
          onChange={(e) => setState((s) => ({ ...s, denomination: e.target.value as Denomination }))}
        >
          {DENOMINATIONS.map((d) => (
            <option key={d} value={d}>
              {tDenominations(d)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sub-phone">{t("fields.phone")}</Label>
          <Input
            id="sub-phone"
            value={state.phone}
            onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-website">{t("fields.website")}</Label>
          <Input
            id="sub-website"
            type="url"
            value={state.website}
            onChange={(e) => setState((s) => ({ ...s, website: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-languages">{t("fields.languages")}</Label>
        <LanguageCombobox
          id="sub-languages"
          multiple
          value={state.languages}
          onChange={(codes) => setState((s) => ({ ...s, languages: codes }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-desc">{t("fields.description")}</Label>
        <textarea
          id="sub-desc"
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.description}
          onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-submitter">{t("fields.submitterEmail")}</Label>
        <Input
          id="sub-submitter"
          type="email"
          value={state.submitterEmail}
          onChange={(e) => setState((s) => ({ ...s, submitterEmail: e.target.value }))}
        />
        {errors.submitterEmail && <p className="text-xs text-danger">{errors.submitterEmail}</p>}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          {submitting ? t("actions.submitting") : t("actions.submit")}
        </Button>
      </div>
    </form>
  );
}
