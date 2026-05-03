"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { pickLocalized } from "@/lib/utils";
import type { BusinessCategory, HalalStatus } from "@/types/business";
import type { Locale } from "@/i18n/config";

const HALAL_STATUSES = ["certified", "self_declared", "muslim_owned", "unverified"] as const;

interface FormState {
  name: string;
  descriptionEn: string;
  categoryIds: string[];
  halalStatus: HalalStatus;
  certificationBodyName: string;
  muslimOwned: boolean;
  isOwner: boolean;
  addressLine1: string;
  city: string;
  region: string;
  countryCode: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  whatsapp: string;
  submitterEmail: string;
  // honeypot
  website_url_secondary: string;
}

const empty: FormState = {
  name: "",
  descriptionEn: "",
  categoryIds: [],
  halalStatus: "self_declared",
  certificationBodyName: "",
  muslimOwned: false,
  isOwner: false,
  addressLine1: "",
  city: "",
  region: "",
  countryCode: "",
  postalCode: "",
  phone: "",
  email: "",
  website: "",
  instagram: "",
  whatsapp: "",
  submitterEmail: "",
  website_url_secondary: "",
};

interface Props {
  categories: BusinessCategory[];
}

export function SubmitBusinessForm({ categories }: Props) {
  const t = useTranslations("businesses.submit");
  const tHalal = useTranslations("businesses.halalStatuses");
  const locale = useLocale() as Locale;
  const [state, setState] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function toggleCategory(id: string) {
    setState((s) => {
      if (s.categoryIds.includes(id)) {
        return { ...s, categoryIds: s.categoryIds.filter((c) => c !== id) };
      }
      if (s.categoryIds.length >= 3) return s;
      return { ...s, categoryIds: [...s.categoryIds, id] };
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (state.name.trim().length < 2) next.name = t("validation.nameRequired");
    if (state.descriptionEn.trim().length < 10) next.descriptionEn = t("validation.descriptionRequired");
    if (state.categoryIds.length === 0) next.categoryIds = t("validation.categoryRequired");
    if (state.addressLine1.trim().length < 2) next.addressLine1 = t("validation.addressRequired");
    if (!state.city.trim()) next.city = t("validation.cityRequired");
    if (!/^[A-Za-z]{2}$/.test(state.countryCode.trim())) next.countryCode = t("validation.countryRequired");
    if (!/^.+@.+\..+$/.test(state.submitterEmail.trim())) next.submitterEmail = t("validation.submitterEmailRequired");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/businesses/submit", {
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
        <Label htmlFor="biz-name">{t("fields.name")}</Label>
        <Input
          id="biz-name"
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
        />
        {errors.name && <p className="text-xs text-danger">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz-description">{t("fields.description")}</Label>
        <textarea
          id="biz-description"
          className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.descriptionEn}
          onChange={(e) => setState((s) => ({ ...s, descriptionEn: e.target.value }))}
          maxLength={2000}
        />
        {errors.descriptionEn && <p className="text-xs text-danger">{errors.descriptionEn}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>
          {t("fields.category")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.categoryHint")}</span>
        </Label>
        {categories.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            {t("noCategoriesYet")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const selected = state.categoryIds.includes(c.id);
              const disabled = !selected && state.categoryIds.length >= 3;
              const label = pickLocalized(c.name, locale, "en") ?? c.name.en;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  disabled={disabled}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  } ${disabled ? "opacity-40" : ""}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {errors.categoryIds && <p className="text-xs text-danger">{errors.categoryIds}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>{t("fields.halalStatus")}</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {HALAL_STATUSES.map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm ${
                state.halalStatus === s ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name="halalStatus"
                value={s}
                checked={state.halalStatus === s}
                onChange={() => setState((st) => ({ ...st, halalStatus: s }))}
                className="mt-0.5"
              />
              <span>{tHalal(s)}</span>
            </label>
          ))}
        </div>
      </div>

      {state.halalStatus === "certified" && (
        <div className="space-y-1.5">
          <Label htmlFor="biz-cert-body">{t("fields.certBody")}</Label>
          <Input
            id="biz-cert-body"
            value={state.certificationBodyName}
            onChange={(e) => setState((s) => ({ ...s, certificationBodyName: e.target.value }))}
            placeholder={t("fields.certBodyPlaceholder")}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="biz-muslim-owned"
          checked={state.muslimOwned}
          onCheckedChange={(v) => setState((s) => ({ ...s, muslimOwned: v === true }))}
        />
        <Label htmlFor="biz-muslim-owned" className="font-normal">
          {t("fields.muslimOwned")}
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="biz-is-owner"
          checked={state.isOwner}
          onCheckedChange={(v) => setState((s) => ({ ...s, isOwner: v === true }))}
        />
        <Label htmlFor="biz-is-owner" className="font-normal">
          {t("fields.isOwner")}
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz-address">{t("fields.addressLine1")}</Label>
        <Input
          id="biz-address"
          value={state.addressLine1}
          onChange={(e) => setState((s) => ({ ...s, addressLine1: e.target.value }))}
        />
        {errors.addressLine1 && <p className="text-xs text-danger">{errors.addressLine1}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="biz-city">{t("fields.city")}</Label>
          <Input
            id="biz-city"
            value={state.city}
            onChange={(e) => setState((s) => ({ ...s, city: e.target.value }))}
          />
          {errors.city && <p className="text-xs text-danger">{errors.city}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-region">{t("fields.region")}</Label>
          <Input
            id="biz-region"
            value={state.region}
            onChange={(e) => setState((s) => ({ ...s, region: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="biz-country">{t("fields.country")}</Label>
          <CountryCombobox
            id="biz-country"
            value={state.countryCode}
            onChange={(code) => setState((s) => ({ ...s, countryCode: code }))}
          />
          {errors.countryCode && <p className="text-xs text-danger">{errors.countryCode}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-postal">{t("fields.postalCode")}</Label>
          <Input
            id="biz-postal"
            value={state.postalCode}
            onChange={(e) => setState((s) => ({ ...s, postalCode: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="biz-phone">{t("fields.phone")}</Label>
          <Input
            id="biz-phone"
            value={state.phone}
            onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-email">{t("fields.email")}</Label>
          <Input
            id="biz-email"
            type="email"
            value={state.email}
            onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz-website">{t("fields.website")}</Label>
        <Input
          id="biz-website"
          type="url"
          placeholder="https://"
          value={state.website}
          onChange={(e) => setState((s) => ({ ...s, website: e.target.value }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="biz-instagram">{t("fields.instagram")}</Label>
          <Input
            id="biz-instagram"
            placeholder="@handle"
            value={state.instagram}
            onChange={(e) => setState((s) => ({ ...s, instagram: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-whatsapp">{t("fields.whatsapp")}</Label>
          <Input
            id="biz-whatsapp"
            placeholder="+44…"
            value={state.whatsapp}
            onChange={(e) => setState((s) => ({ ...s, whatsapp: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz-submitter">{t("fields.submitterEmail")}</Label>
        <Input
          id="biz-submitter"
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
