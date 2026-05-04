"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { SearchableMultiCombobox } from "@/components/common/SearchableMultiCombobox";
import { MosqueMap } from "@/components/mosque/MosqueMap";
import { getCallingCode } from "@/lib/countries/calling-codes";
import { suggestCountryForTimezone } from "@/lib/countries/tz-to-country";
import { pickLocalized } from "@/lib/utils";
import { createBusinessAction } from "@/lib/admin/actions/businesses";
import type { BusinessInput } from "@/lib/businesses/schemas";
import type { BusinessCategory, BusinessStatus, HalalStatus } from "@/types/business";
import type { Locale } from "@/i18n/config";

const HALAL_STATUSES = ["certified", "self_declared", "muslim_owned", "unverified"] as const;
const PUBLIC_STEPS = ["basics", "halal", "location", "review"] as const;
const ADMIN_STEPS = ["basics", "halal", "location", "admin", "review"] as const;
type Step = (typeof ADMIN_STEPS)[number];

const ADMIN_STATUSES: BusinessStatus[] = ["draft", "published", "archived"];

const DRAFT_STORAGE_KEY = "i-muslim.business-submission-draft";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingDraft {
  fields: Partial<FormState>;
  savedAt: number;
}

type GeocodeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number }
  | { status: "fail" };

function formatRelativeAge(savedAtMs: number, locale: string): string {
  const diffMs = Date.now() - savedAtMs;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return rtf.format(0, "minute");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
}

interface FormState {
  name: string;
  descriptionEn: string;
  categoryIds: string[];
  halalStatus: HalalStatus;
  certificationBodyName: string;
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
  // Admin-only — surfaced when adminMode is true.
  adminStatus: BusinessStatus;
  // honeypot
  website_url_secondary: string;
}

const empty: FormState = {
  name: "",
  descriptionEn: "",
  categoryIds: [],
  halalStatus: "self_declared",
  certificationBodyName: "",
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
  adminStatus: "draft",
  website_url_secondary: "",
};

interface Props {
  categories: BusinessCategory[];
  userEmail: string;
  /** When true, skip honeypot/Turnstile/isOwner/sessionStorage and submit via the admin server action. */
  adminMode?: boolean;
  onAdminSaved?: (result: { id: string }) => void;
  onAdminCancel?: () => void;
}

export function SubmitBusinessForm({
  categories,
  userEmail,
  adminMode = false,
  onAdminSaved,
  onAdminCancel,
}: Props) {
  const t = useTranslations("businesses.submit");
  const tHalal = useTranslations("businesses.halalStatuses");
  const tStatus = useTranslations("businesses.statuses");
  const tQuick = useTranslations("quickCreate");
  const locale = useLocale() as Locale;

  const STEPS: readonly Step[] = adminMode ? ADMIN_STEPS : PUBLIC_STEPS;

  const [state, setState] = useState<FormState>(empty);
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null);
  const [geocode, setGeocode] = useState<GeocodeState>({ status: "idle" });
  const hydrated = useRef(false);

  // Draft load: only in public mode. Admin UAPOP is transient.
  useEffect(() => {
    if (adminMode || typeof window === "undefined") {
      hydrated.current = true;
      applyCountryDefault();
      return;
    }
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<FormState> & {
          __step?: number;
          __savedAt?: number;
        };
        const { __step: _step, __savedAt, ...savedFields } = saved;
        void _step;
        const hasContent = Object.entries(savedFields).some(([k, v]) => {
          if (k === "halalStatus") return v !== "self_declared";
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === "boolean") return v;
          return typeof v === "string" && v.length > 0;
        });
        const savedAt = typeof __savedAt === "number" ? __savedAt : 0;
        const stale = Date.now() - savedAt > DRAFT_TTL_MS;
        if (hasContent && !stale) {
          setPendingDraft({ fields: savedFields, savedAt });
          return;
        }
        if (stale) sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      // ignore corrupt draft
    }
    hydrated.current = true;
    applyCountryDefault();
  }, [adminMode]);

  // Draft save: only in public mode.
  useEffect(() => {
    if (adminMode || !hydrated.current || typeof window === "undefined" || done) return;
    try {
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ ...state, __step: stepIdx, __savedAt: Date.now() }),
      );
    } catch {
      // quota exceeded — ignore
    }
  }, [state, stepIdx, done, adminMode]);

  const reviewAddress =
    state.addressLine1.trim() && state.city.trim() && state.countryCode
      ? [state.addressLine1, state.city, state.region, state.postalCode, state.countryCode]
          .filter(Boolean)
          .join(", ")
      : "";

  useEffect(() => {
    if (STEPS[stepIdx] !== "review" || !reviewAddress) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGeocode({ status: "loading" });
    (async () => {
      try {
        const res = await fetch(
          `/api/businesses/geocode?q=${encodeURIComponent(reviewAddress)}`,
        );
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          lat?: number;
          lng?: number;
        };
        if (cancelled) return;
        if (res.ok && data.ok && typeof data.lat === "number" && typeof data.lng === "number") {
          setGeocode({ status: "ok", lat: data.lat, lng: data.lng });
        } else {
          setGeocode({ status: "fail" });
        }
      } catch {
        if (!cancelled) setGeocode({ status: "fail" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stepIdx, reviewAddress, STEPS]);

  function applyCountryDefault() {
    setState((prev) => {
      if (prev.countryCode) return prev;
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const detected = suggestCountryForTimezone(tz);
        if (!detected) return prev;
        return { ...prev, countryCode: detected };
      } catch {
        return prev;
      }
    });
  }

  function resumeDraft() {
    if (!pendingDraft) return;
    setState((prev) => ({ ...prev, ...pendingDraft.fields }));
    setStepIdx(0);
    setPendingDraft(null);
    hydrated.current = true;
    applyCountryDefault();
    toast.message(t("draftRestored"));
  }

  function startFresh() {
    clearDraft();
    setPendingDraft(null);
    hydrated.current = true;
    applyCountryDefault();
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  function discardDraft() {
    clearDraft();
    setState(empty);
    setStepIdx(0);
    setErrors({});
    toast.success(t("draftCleared"));
  }

  function validateStep(step: Step): Record<string, string> {
    const next: Record<string, string> = {};
    if (step === "basics") {
      if (state.name.trim().length < 2) next.name = t("validation.nameRequired");
      const descLen = state.descriptionEn.trim().length;
      if (descLen < 40) next.descriptionEn = t("validation.descriptionMin");
      else if (descLen > 500) next.descriptionEn = t("validation.descriptionMax");
      if (state.categoryIds.length === 0) next.categoryIds = t("validation.categoryRequired");
    }
    if (step === "halal") {
      if (state.halalStatus === "certified" && !state.certificationBodyName.trim()) {
        next.certificationBodyName = t("validation.certBodyRequired");
      }
    }
    if (step === "location") {
      if (state.addressLine1.trim().length < 2) next.addressLine1 = t("validation.addressRequired");
      if (!state.city.trim()) next.city = t("validation.cityRequired");
      if (!/^[A-Za-z]{2}$/.test(state.countryCode.trim())) next.countryCode = t("validation.countryRequired");
      const phone = state.phone.trim();
      if (phone && !/^[+]?[\d\s()-]{7,}$/.test(phone)) {
        next.phone = t("validation.phoneInvalid");
      }
      const email = state.email.trim();
      if (email && !/^.+@.+\..+$/.test(email)) {
        next.email = t("validation.emailInvalid");
      }
      const website = state.website.trim();
      if (website) {
        const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`;
        try {
          new URL(candidate);
        } catch {
          next.website = t("validation.websiteInvalid");
        }
      }
    }
    // No validation for "admin" — status is a select with a default.
    return next;
  }

  function focusFirstError(errs: Record<string, string>) {
    const FIELD_TO_ID: Record<string, string> = {
      name: "biz-name",
      descriptionEn: "biz-description",
      categoryIds: "biz-category",
      certificationBodyName: "biz-cert-body",
      addressLine1: "biz-address",
      city: "biz-city",
      countryCode: "biz-country",
      phone: "biz-phone",
      email: "biz-email",
      website: "biz-website",
    };
    const first = Object.keys(errs)[0];
    if (!first) return;
    const id = FIELD_TO_ID[first];
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el && typeof (el as HTMLElement).focus === "function") {
        (el as HTMLElement).focus();
      }
    });
  }

  function handleNext() {
    const step = STEPS[stepIdx];
    if (!step) return;
    const stepErrors = validateStep(step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      toast.error(t("validation.fixStep"));
      focusFirstError(stepErrors);
      return;
    }
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
  }

  function handleBack() {
    setErrors({});
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }

  function jumpToStep(target: number) {
    setErrors({});
    setStepIdx(target);
  }

  function buildAdminInput(): BusinessInput {
    const lat = geocode.status === "ok" ? geocode.lat : 0;
    const lng = geocode.status === "ok" ? geocode.lng : 0;
    return {
      status: state.adminStatus,
      name: state.name.trim(),
      description: { en: state.descriptionEn.trim() },
      categoryIds: state.categoryIds,
      halal: {
        status: state.halalStatus,
        // Public form has free-text; admin schema accepts an optional id-shaped
        // string. Pass the typed name through as a placeholder; admin can re-link
        // to the curated cert body in the full editor afterwards.
        certificationBodyId:
          state.halalStatus === "certified" ? state.certificationBodyName.trim() || undefined : undefined,
        certificationNumber: undefined,
        expiresAt: undefined,
      },
      muslimOwned: state.halalStatus === "muslim_owned",
      contact: {
        phone: state.phone.trim() || undefined,
        email: state.email.trim() || undefined,
        website: state.website.trim() || undefined,
        instagram: state.instagram.trim() || undefined,
        whatsapp: state.whatsapp.trim() || undefined,
      },
      address: {
        line1: state.addressLine1.trim(),
        city: state.city.trim(),
        region: state.region.trim() || undefined,
        countryCode: state.countryCode.trim().toUpperCase(),
        postalCode: state.postalCode.trim() || undefined,
        lat,
        lng,
      },
      hours: {
        mon: null,
        tue: null,
        wed: null,
        thu: null,
        fri: null,
        sat: null,
        sun: null,
        notes: undefined,
      },
      amenityIds: [],
      photos: [],
      platformVerifiedAt: undefined,
      ownerEmail: undefined,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (let i = 0; i < STEPS.length; i += 1) {
      const step = STEPS[i]!;
      const stepErrors = validateStep(step);
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        setStepIdx(i);
        toast.error(t("validation.fixStep"));
        focusFirstError(stepErrors);
        return;
      }
    }
    setSubmitting(true);
    try {
      if (adminMode) {
        const result = await createBusinessAction(buildAdminInput());
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (geocode.status !== "ok") {
          toast.message(tQuick("adminFields.coordsMissingHint"));
        }
        toast.success(t("success"));
        onAdminSaved?.({ id: result.data.id });
        return;
      }

      const res = await fetch("/api/businesses/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...state,
          geocoded:
            geocode.status === "ok" ? { lat: geocode.lat, lng: geocode.lng } : null,
        }),
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
      clearDraft();
      setState(empty);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done && !adminMode) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-base font-medium text-foreground">{t("success")}</p>
      </div>
    );
  }

  const step = STEPS[stepIdx]!;
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <>
      {!adminMode && (
        <Dialog
          open={pendingDraft !== null}
          onOpenChange={(open) => {
            if (!open) startFresh();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("draftDialog.title")}</DialogTitle>
              <DialogDescription>
                {pendingDraft
                  ? t("draftDialog.body", {
                      when: formatRelativeAge(pendingDraft.savedAt, locale),
                    })
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="secondary" onClick={startFresh}>
                {t("draftDialog.startFresh")}
              </Button>
              <Button type="button" onClick={resumeDraft}>
                {t("draftDialog.resume")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {!adminMode && (
          <input
            type="text"
            name="website_url_secondary"
            autoComplete="off"
            tabIndex={-1}
            className="hidden"
            value={state.website_url_secondary}
            onChange={(e) => setState((s) => ({ ...s, website_url_secondary: e.target.value }))}
          />
        )}

        <ol className="flex items-center gap-2 text-xs">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const completed = i < stepIdx;
            const stepLabel = s === "admin" ? tQuick("steps.admin") : t(`steps.${s}`);
            return (
              <li key={s} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => jumpToStep(i)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : completed
                        ? "border border-primary text-primary hover:bg-primary/10"
                        : "border border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span
                    className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                      active
                        ? "bg-primary-foreground text-primary"
                        : completed
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {stepLabel}
                </button>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="text-muted-foreground">›</span>
                )}
              </li>
            );
          })}
        </ol>

        {step === "basics" && (
          <div className="space-y-5">
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
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={state.descriptionEn}
                onChange={(e) => setState((s) => ({ ...s, descriptionEn: e.target.value }))}
                maxLength={500}
              />
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-danger">{errors.descriptionEn ?? ""}</p>
                {(() => {
                  const len = state.descriptionEn.length;
                  const tone =
                    len > 500
                      ? "text-danger"
                      : len < 40 || len >= 450
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground";
                  return <span className={`shrink-0 text-xs tabular-nums ${tone}`}>{len} / 500</span>;
                })()}
              </div>
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
                <SearchableMultiCombobox
                  id="biz-category"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: pickLocalized(c.name, locale, "en") ?? c.name.en,
                  }))}
                  value={state.categoryIds}
                  onChange={(next) =>
                    setState((s) => ({ ...s, categoryIds: next.slice(0, 3) }))
                  }
                  placeholder={t("fields.categoryPlaceholder")}
                  searchPlaceholder={t("fields.categorySearchPlaceholder")}
                  emptyText={t("fields.categoryNoResults")}
                  removeChipLabel={(name) => t("fields.categoryRemoveChip", { name })}
                  moreText={(count) => t("fields.categoryMoreItems", { count })}
                  ariaLabel={t("fields.category")}
                />
              )}
              {errors.categoryIds && <p className="text-xs text-danger">{errors.categoryIds}</p>}
            </div>
          </div>
        )}

        {step === "halal" && (
          <div className="space-y-5">
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
                {errors.certificationBodyName && (
                  <p className="text-xs text-danger">{errors.certificationBodyName}</p>
                )}
              </div>
            )}

            {!adminMode && (
              <>
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

                {state.isOwner && (
                  <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    {t("ownerNotice", { email: userEmail })}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {step === "location" && (
          <div className="space-y-5">
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
                  placeholder={(() => {
                    const code = getCallingCode(state.countryCode);
                    return code ? `+${code} …` : undefined;
                  })()}
                  onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
                />
                {errors.phone && <p className="text-xs text-danger">{errors.phone}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-email">{t("fields.email")}</Label>
                <Input
                  id="biz-email"
                  type="email"
                  value={state.email}
                  onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
                />
                {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
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
              {errors.website && <p className="text-xs text-danger">{errors.website}</p>}
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
          </div>
        )}

        {step === "admin" && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="biz-admin-status">{tQuick("adminFields.status")}</Label>
              <select
                id="biz-admin-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={state.adminStatus}
                onChange={(e) =>
                  setState((s) => ({ ...s, adminStatus: e.target.value as BusinessStatus }))
                }
              >
                {ADMIN_STATUSES.map((opt) => (
                  <option key={opt} value={opt}>
                    {tStatus(opt)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {tQuick("adminFields.statusHintBusiness")}
              </p>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <ReviewSection
              title={t("steps.basics")}
              onEdit={() => jumpToStep(STEPS.indexOf("basics"))}
              editLabel={t("review.editSection", { section: t("steps.basics") })}
              rows={[
                { label: t("fields.name"), value: state.name },
                { label: t("fields.description"), value: state.descriptionEn },
                {
                  label: t("fields.category"),
                  value:
                    state.categoryIds
                      .map((id) => {
                        const c = categories.find((x) => x.id === id);
                        return c ? pickLocalized(c.name, locale, "en") ?? c.name.en : id;
                      })
                      .join(", ") || "—",
                },
              ]}
            />

            <ReviewSection
              title={t("steps.halal")}
              onEdit={() => jumpToStep(STEPS.indexOf("halal"))}
              editLabel={t("review.editSection", { section: t("steps.halal") })}
              rows={[
                { label: t("fields.halalStatus"), value: tHalal(state.halalStatus) },
                ...(state.halalStatus === "certified" && state.certificationBodyName
                  ? [{ label: t("fields.certBody"), value: state.certificationBodyName }]
                  : []),
                ...(adminMode
                  ? []
                  : [{ label: t("fields.isOwner"), value: state.isOwner ? "Yes" : "No" }]),
              ]}
            />

            <ReviewSection
              title={t("steps.location")}
              onEdit={() => jumpToStep(STEPS.indexOf("location"))}
              editLabel={t("review.editSection", { section: t("steps.location") })}
              rows={[
                {
                  label: t("fields.addressLine1"),
                  value: [state.addressLine1, state.city, state.region, state.postalCode, state.countryCode]
                    .filter(Boolean)
                    .join(", "),
                },
                ...(state.phone ? [{ label: t("fields.phone"), value: state.phone }] : []),
                ...(state.email ? [{ label: t("fields.email"), value: state.email }] : []),
                ...(state.website ? [{ label: t("fields.website"), value: state.website }] : []),
                ...(state.instagram ? [{ label: t("fields.instagram"), value: state.instagram }] : []),
                ...(state.whatsapp ? [{ label: t("fields.whatsapp"), value: state.whatsapp }] : []),
              ]}
            />

            {geocode.status === "loading" && (
              <div className="h-[240px] w-full animate-pulse rounded-md bg-muted" aria-hidden />
            )}
            {geocode.status === "ok" && (
              <MosqueMap
                lat={geocode.lat}
                lng={geocode.lng}
                className="h-[240px] w-full overflow-hidden rounded-md"
              />
            )}
            {geocode.status === "fail" && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {t("review.geocodeFailed")}
              </p>
            )}

            {adminMode && (
              <ReviewSection
                title={tQuick("steps.admin")}
                onEdit={() => jumpToStep(STEPS.indexOf("admin"))}
                editLabel={t("review.editSection", { section: tQuick("steps.admin") })}
                rows={[{ label: tQuick("adminFields.status"), value: tStatus(state.adminStatus) }]}
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          {adminMode ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAdminCancel}
              className="text-muted-foreground"
              disabled={submitting}
            >
              {tQuick("cancel")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discardDraft}
              className="text-muted-foreground"
            >
              <Trash2 /> {t("discardDraft")}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <Button type="button" variant="secondary" onClick={handleBack} disabled={submitting}>
                <ArrowLeft /> {t("actions.back")}
              </Button>
            )}
            {!isLast && (
              <Button type="button" onClick={handleNext}>
                {t("actions.next")} <ArrowRight />
              </Button>
            )}
            {isLast && (
              <Button type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Send />}
                {submitting
                  ? t("actions.submitting")
                  : adminMode
                    ? tQuick("create")
                    : t("actions.submit")}
              </Button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}

interface ReviewSectionProps {
  title: string;
  onEdit: () => void;
  editLabel: string;
  rows: Array<{ label: string; value: string }>;
}

function ReviewSection({ title, onEdit, editLabel, rows }: ReviewSectionProps) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil /> {editLabel}
        </Button>
      </header>
      <dl className="grid gap-1 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="whitespace-pre-line break-words">{row.value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
