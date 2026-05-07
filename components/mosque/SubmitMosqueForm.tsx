"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2, MapPin, Pencil, Plus, Save, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { LanguageCombobox } from "@/components/common/LanguageCombobox";
import { MosqueMap } from "@/components/mosque/MosqueMap";
import { MosqueImageUploader } from "@/components/admin/mosques/MosqueImageUploader";
import { getCallingCode } from "@/lib/countries/calling-codes";
import { suggestCountryForTimezone } from "@/lib/countries/tz-to-country";
import { cn } from "@/lib/utils";
import { DENOMINATIONS, deriveFacilitiesFromServices } from "@/lib/mosques/constants";
import { defaultPrayerCalc, suggestPrayerCalc } from "@/lib/mosques/adhan";
import {
  createMosque,
  lookupUserByEmailAction,
  updateMosque,
  type MosqueInput,
} from "@/app/[locale]/(admin)/admin/mosques/actions";
import type {
  AsrMethod,
  CalcMethod,
  Denomination,
  HighLatitudeRule,
  Mosque,
  MosqueFacility,
  MosqueStatus,
} from "@/types/mosque";

const PUBLIC_STEPS = ["basics", "location", "contact", "review"] as const;
const ADMIN_STEPS = [
  "basics",
  "location",
  "contact",
  "facilities",
  "prayer",
  "media",
  "admin",
  "review",
] as const;
type Step = (typeof ADMIN_STEPS)[number];

const ADMIN_STATUSES: MosqueStatus[] = ["draft", "pending_review", "published", "suspended"];
const CALC_METHODS: CalcMethod[] = ["MWL", "ISNA", "EGYPT", "MAKKAH", "KARACHI", "TEHRAN", "JAFARI"];
const HIGH_LAT_RULES: HighLatitudeRule[] = ["MIDDLE_OF_NIGHT", "ANGLE_BASED", "ONE_SEVENTH"];

type GeocodeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number }
  | { status: "fail" };

interface FormState {
  // Basics
  nameEn: string;
  nameAr: string;
  legalName: string;
  description: string;
  denomination: Denomination;
  // Location
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  countryCode: string;
  postalCode: string;
  lat: string;
  lng: string;
  timezone: string;
  // Contact + social
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  youtube: string;
  whatsapp: string;
  languages: string[];
  altSpellings: string;
  capacity: string;
  // Facilities — slugs into the admin-managed mosqueFacilities collection
  facilities: string[];
  // Prayer
  calcMethod: CalcMethod;
  asrMethod: AsrMethod;
  highLatitudeRule: HighLatitudeRule;
  // Media
  coverImageUrl: string;
  coverImageStoragePath: string;
  logoUrl: string;
  logoStoragePath: string;
  // Admin
  adminStatus: MosqueStatus;
  // Mosque managers — uid + display label (email/name) for the chip list.
  // The form persists `uid[]` in `MosqueInput.managers`; the labels are
  // display-only and resolved via `lookupUserByEmailAction` when an admin
  // adds a manager by email.
  managers: Array<{ uid: string; label: string }>;
  // honeypot
  website_url_secondary: string;
}

function emptyState(): FormState {
  const calc = defaultPrayerCalc();
  return {
    nameEn: "",
    nameAr: "",
    legalName: "",
    description: "",
    denomination: "unspecified",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    countryCode: "",
    postalCode: "",
    lat: "",
    lng: "",
    timezone: "",
    phone: "",
    email: "",
    website: "",
    facebook: "",
    instagram: "",
    youtube: "",
    whatsapp: "",
    languages: [],
    altSpellings: "",
    capacity: "",
    facilities: [],
    calcMethod: calc.method,
    asrMethod: calc.asrMethod,
    highLatitudeRule: calc.highLatitudeRule,
    coverImageUrl: "",
    coverImageStoragePath: "",
    logoUrl: "",
    logoStoragePath: "",
    adminStatus: "draft",
    managers: [],
    website_url_secondary: "",
  };
}

function fromMosque(m: Mosque): FormState {
  const calc = m.prayerCalc ?? defaultPrayerCalc();
  return {
    nameEn: m.name.en ?? "",
    nameAr: m.name.ar ?? "",
    legalName: m.legalName ?? "",
    description: m.description?.en ?? "",
    denomination: m.denomination,
    addressLine1: m.address.line1 ?? "",
    addressLine2: m.address.line2 ?? "",
    city: m.city ?? "",
    region: m.region ?? "",
    countryCode: m.country ?? "",
    postalCode: m.address.postalCode ?? "",
    lat: Number.isFinite(m.location?.lat) ? String(m.location.lat) : "",
    lng: Number.isFinite(m.location?.lng) ? String(m.location.lng) : "",
    timezone: m.timezone ?? "",
    phone: m.contact?.phone ?? "",
    email: m.contact?.email ?? "",
    website: m.contact?.website ?? "",
    facebook: m.social?.facebook ?? "",
    instagram: m.social?.instagram ?? "",
    youtube: m.social?.youtube ?? "",
    whatsapp: m.social?.whatsapp ?? "",
    languages: m.languages ?? [],
    altSpellings: (m.altSpellings ?? []).join(", "),
    capacity: typeof m.capacity === "number" ? String(m.capacity) : "",
    // Prefer the new `facilities[]` shape; fall back to deriving from the
    // legacy `services{}` boolean map for records saved before the taxonomy
    // existed. This is read-only back-compat — the form writes `facilities[]`.
    facilities: m.facilities && m.facilities.length > 0
      ? [...m.facilities]
      : deriveFacilitiesFromServices(m.services),
    calcMethod: calc.method,
    asrMethod: calc.asrMethod,
    highLatitudeRule: calc.highLatitudeRule,
    coverImageUrl: m.coverImage?.url ?? "",
    coverImageStoragePath: m.coverImage?.storagePath ?? "",
    logoUrl: m.logoUrl ?? "",
    logoStoragePath: m.logoStoragePath ?? "",
    adminStatus: m.status,
    // Email/name labels aren't stored on the mosque doc — only uids. Show the
    // uid as a fallback label until the admin re-adds via email lookup.
    managers: (m.managers ?? []).map((uid) => ({ uid, label: uid })),
    website_url_secondary: "",
  };
}

interface Props {
  /** Signed-in user's email (server-side enforces auth; this is informational). */
  userEmail: string;
  /** When true, skip honeypot/Turnstile and submit via the admin server action. */
  adminMode?: boolean;
  /** "edit" requires `initial`; falls back to "create" otherwise. */
  mode?: "create" | "edit";
  initial?: Mosque;
  /**
   * Admin-managed facility taxonomy used to render the Facilities step. Only
   * required in adminMode — public submissions don't include the step.
   */
  facilities?: MosqueFacility[];
  onAdminSaved?: (result: { slug: string }) => void;
  onAdminCancel?: () => void;
}

export function SubmitMosqueForm({
  userEmail,
  adminMode = false,
  mode = "create",
  initial,
  facilities = [],
  onAdminSaved,
  onAdminCancel,
}: Props) {
  void userEmail;
  const t = useTranslations("mosques.submit");
  const tDenominations = useTranslations("mosques.denominations");
  const tQuick = useTranslations("quickCreate");
  const tStatuses = useTranslations("mosquesAdmin.statuses");
  const tForm = useTranslations("mosquesAdmin.form");

  const isEdit = adminMode && mode === "edit" && Boolean(initial);
  const STEPS: readonly Step[] = adminMode ? ADMIN_STEPS : PUBLIC_STEPS;

  const [state, setState] = useState<FormState>(() =>
    initial ? fromMosque(initial) : emptyState(),
  );
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [reviewGeocode, setReviewGeocode] = useState<GeocodeState>({ status: "idle" });
  // Tracks whether the admin has manually touched any prayer field. Once true,
  // we stop auto-suggesting based on country/denomination changes — otherwise
  // an admin's deliberate override could be silently overwritten.
  const prayerCalcDirty = useRef(false);

  // Add-manager-by-email controls (admin step). Local to the form — no need
  // to live in `state` since they don't survive a save/reset.
  const [managerEmailInput, setManagerEmailInput] = useState("");
  const [managerLookupBusy, setManagerLookupBusy] = useState(false);

  async function addManagerByEmail() {
    const email = managerEmailInput.trim();
    if (!email) return;
    setManagerLookupBusy(true);
    try {
      const result = await lookupUserByEmailAction(email);
      if (!result.ok) {
        if (result.error === "not_found") toast.error(tForm("managers.notFound"));
        else if (result.error === "invalid_email") toast.error(tForm("managers.invalidEmail"));
        else toast.error(tForm("managers.errorGeneric"));
        return;
      }
      setState((s) => {
        if (s.managers.some((m) => m.uid === result.data.uid)) return s;
        const label = result.data.displayName
          ? `${result.data.displayName} <${result.data.email}>`
          : result.data.email;
        return { ...s, managers: [...s.managers, { uid: result.data.uid, label }] };
      });
      setManagerEmailInput("");
    } finally {
      setManagerLookupBusy(false);
    }
  }

  function removeManager(uid: string) {
    setState((s) => ({ ...s, managers: s.managers.filter((m) => m.uid !== uid) }));
  }

  // On first mount, default the country from the browser's TZ for nicer UX.
  // (Edit mode skips this — country is always pre-filled.)
  useEffect(() => {
    if (initial) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [initial]);

  // Reactively suggest prayer calc based on (country, denomination) — only
  // until the admin manually edits one of the prayer fields.
  useEffect(() => {
    if (!adminMode || prayerCalcDirty.current) return;
    if (!state.countryCode) return;
    const suggested = suggestPrayerCalc(state.countryCode, state.denomination);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => {
      if (
        prev.calcMethod === suggested.method &&
        prev.asrMethod === suggested.asrMethod &&
        prev.highLatitudeRule === suggested.highLatitudeRule
      ) {
        return prev;
      }
      return {
        ...prev,
        calcMethod: suggested.method,
        asrMethod: suggested.asrMethod,
        highLatitudeRule: suggested.highLatitudeRule,
      };
    });
  }, [adminMode, state.countryCode, state.denomination]);

  const reviewAddress =
    state.addressLine1.trim() && state.city.trim() && state.countryCode
      ? [state.addressLine1, state.city, state.region, state.postalCode, state.countryCode]
          .filter(Boolean)
          .join(", ")
      : "";

  // Public review step: best-effort geocode preview only (admin step has its
  // own button + saved coords). Skipped entirely when adminMode is on so we
  // don't double-fetch the same address.
  useEffect(() => {
    if (adminMode) return;
    if (STEPS[stepIdx] !== "review" || !reviewAddress) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReviewGeocode({ status: "loading" });
    const queries = Array.from(
      new Set(
        [
          reviewAddress,
          [state.addressLine1, state.city, state.countryCode].filter(Boolean).join(", "),
          [state.city, state.region, state.countryCode].filter(Boolean).join(", "),
          [state.city, state.countryCode].filter(Boolean).join(", "),
        ].filter((q) => q.trim().length > 0),
      ),
    );
    (async () => {
      for (const q of queries) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/businesses/geocode?q=${encodeURIComponent(q)}`);
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            lat?: number;
            lng?: number;
          };
          if (cancelled) return;
          if (res.ok && data.ok && typeof data.lat === "number" && typeof data.lng === "number") {
            setReviewGeocode({ status: "ok", lat: data.lat, lng: data.lng });
            return;
          }
        } catch {
          // try the next, less specific query
        }
      }
      if (!cancelled) setReviewGeocode({ status: "fail" });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    adminMode,
    stepIdx,
    reviewAddress,
    STEPS,
    state.addressLine1,
    state.city,
    state.region,
    state.countryCode,
  ]);

  function validateStep(step: Step): Record<string, string> {
    const next: Record<string, string> = {};
    if (step === "basics") {
      if (state.nameEn.trim().length < 2) next.nameEn = t("validation.nameRequired");
      if (state.description.trim().length > 500) next.description = t("validation.descriptionMax");
    }
    if (step === "location") {
      if (state.addressLine1.trim().length < 2) next.addressLine1 = t("validation.addressRequired");
      if (!state.city.trim()) next.city = t("validation.cityRequired");
      if (!/^[A-Za-z]{2}$/.test(state.countryCode.trim())) next.country = t("validation.countryRequired");
      if (adminMode) {
        const lat = parseFloat(state.lat);
        const lng = parseFloat(state.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          next.coords = tForm("validation.coordsRequired");
        } else if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          next.coords = tForm("validation.coordsRange");
        }
        if (!state.timezone.trim()) next.timezone = tForm("validation.coordsRequired");
      }
    }
    if (step === "contact") {
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
      if (adminMode) {
        for (const [field, val] of [
          ["facebook", state.facebook],
          ["instagram", state.instagram],
          ["youtube", state.youtube],
        ] as const) {
          const v = val.trim();
          if (!v) continue;
          try {
            new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
          } catch {
            next[field] = tForm("validation.urlInvalid");
          }
        }
      }
    }
    if (step === "media" && adminMode) {
      for (const [field, val] of [
        ["coverImageUrl", state.coverImageUrl],
        ["logoUrl", state.logoUrl],
      ] as const) {
        const v = val.trim();
        if (!v) continue;
        try {
          new URL(v);
        } catch {
          next[field] = tForm("validation.urlInvalid");
        }
      }
    }
    return next;
  }

  function focusFirstError(errs: Record<string, string>) {
    const FIELD_TO_ID: Record<string, string> = {
      nameEn: "sub-name-en",
      description: "sub-desc",
      addressLine1: "sub-address",
      city: "sub-city",
      country: "sub-country",
      coords: "sub-lat",
      timezone: "sub-tz",
      phone: "sub-phone",
      email: "sub-email",
      website: "sub-website",
      facebook: "sub-facebook",
      instagram: "sub-instagram",
      youtube: "sub-youtube",
      coverImageUrl: "sub-cover",
      logoUrl: "sub-logo",
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

  function normalizedWebsite(): string {
    const trimmed = state.website.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function normalizedUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  async function runGeocode() {
    const parts = [state.addressLine1, state.city, state.region, state.countryCode]
      .filter(Boolean)
      .join(", ");
    if (!parts) return;
    setGeocodeBusy(true);
    try {
      const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(parts)}`);
      if (!res.ok) {
        toast.error(tForm("geocodeNoResult"));
        return;
      }
      const data = (await res.json()) as { lat?: number; lng?: number; timezone?: string };
      if (typeof data.lat !== "number" || typeof data.lng !== "number") {
        toast.error(tForm("geocodeNoResult"));
        return;
      }
      setState((s) => ({
        ...s,
        lat: String(data.lat),
        lng: String(data.lng),
        timezone: data.timezone ?? s.timezone,
      }));
    } finally {
      setGeocodeBusy(false);
    }
  }

  function buildAdminInput(): MosqueInput {
    const description = state.description.trim();
    const nameAr = state.nameAr.trim();
    const website = normalizedWebsite();
    const lat = parseFloat(state.lat);
    const lng = parseFloat(state.lng);
    const capacity = state.capacity.trim() === "" ? undefined : Math.max(0, Number(state.capacity));
    const altSpellings = state.altSpellings
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return {
      name: {
        en: state.nameEn.trim(),
        ...(nameAr ? { ar: nameAr } : {}),
      },
      legalName: state.legalName.trim() || undefined,
      denomination: state.denomination,
      ...(description.length >= 2 ? { description: { en: description } } : {}),
      address: {
        line1: state.addressLine1.trim(),
        ...(state.addressLine2.trim() ? { line2: state.addressLine2.trim() } : {}),
        ...(state.postalCode.trim() ? { postalCode: state.postalCode.trim() } : {}),
      },
      city: state.city.trim(),
      ...(state.region.trim() ? { region: state.region.trim() } : {}),
      country: state.countryCode.trim().toUpperCase(),
      location: { lat, lng },
      timezone: state.timezone.trim(),
      contact: {
        phone: state.phone.trim() || undefined,
        email: state.email.trim() || undefined,
        website: website || undefined,
      },
      social: {
        facebook: normalizedUrl(state.facebook) || undefined,
        instagram: normalizedUrl(state.instagram) || undefined,
        youtube: normalizedUrl(state.youtube) || undefined,
        whatsapp: state.whatsapp.trim() || undefined,
      },
      capacity: Number.isFinite(capacity) ? capacity : undefined,
      facilities: state.facilities,
      languages: state.languages,
      altSpellings: altSpellings.length > 0 ? altSpellings : undefined,
      prayerCalc: {
        method: state.calcMethod,
        asrMethod: state.asrMethod,
        highLatitudeRule: state.highLatitudeRule,
      },
      coverImageUrl: state.coverImageUrl.trim() || "",
      coverImageStoragePath: state.coverImageStoragePath || "",
      logoUrl: state.logoUrl.trim() || "",
      logoStoragePath: state.logoStoragePath || "",
      status: state.adminStatus,
      managers: state.managers.map((m) => m.uid),
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
        const input = buildAdminInput();
        let result: Awaited<ReturnType<typeof createMosque>>;
        try {
          result = isEdit && initial
            ? await updateMosque(initial.slug, input)
            : await createMosque(input);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("errorGeneric"));
          return;
        }
        if (!result.ok) {
          toast.error(result.error ?? t("errorGeneric"));
          return;
        }
        toast.success(t("success"));
        onAdminSaved?.({ slug: result.slug ?? initial?.slug ?? "" });
        return;
      }

      const res = await fetch("/api/mosques/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameEn: state.nameEn,
          nameAr: state.nameAr,
          addressLine1: state.addressLine1,
          city: state.city,
          country: state.countryCode,
          denomination: state.denomination,
          phone: state.phone,
          website: normalizedWebsite(),
          email: state.email,
          description: state.description,
          languages: state.languages,
          website_url_secondary: state.website_url_secondary,
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
      setState(emptyState());
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
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-6", adminMode && "flex h-full flex-col space-y-0")}
    >
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

      <div className={cn(adminMode && "border-b border-border px-4 pb-3 pt-4 md:px-6")}>
        <ol className="flex items-center gap-2 overflow-x-auto text-xs">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const completed = i < stepIdx;
            const stepLabel = stepLabelFor(s, t, tQuick, tForm);
            return (
              <li key={s} className="flex shrink-0 items-center gap-2">
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
      </div>

      <div className={cn(adminMode && "flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-4 md:px-6")}>
        {step === "basics" && (
          <div className="space-y-5">
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

            {adminMode && (
              <div className="space-y-1.5">
                <Label htmlFor="sub-legal-name">{tForm("legalName")}</Label>
                <Input
                  id="sub-legal-name"
                  value={state.legalName}
                  onChange={(e) => setState((s) => ({ ...s, legalName: e.target.value }))}
                />
              </div>
            )}

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

            <div className="space-y-1.5">
              <Label htmlFor="sub-desc">{t("fields.description")}</Label>
              <textarea
                id="sub-desc"
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={state.description}
                onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
                maxLength={500}
              />
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-danger">{errors.description ?? ""}</p>
                {(() => {
                  const len = state.description.length;
                  const tone =
                    len > 500
                      ? "text-danger"
                      : len >= 450
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground";
                  return <span className={`shrink-0 text-xs tabular-nums ${tone}`}>{len} / 500</span>;
                })()}
              </div>
            </div>
          </div>
        )}

        {step === "location" && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="sub-address">{t("fields.addressLine1")}</Label>
              <Input
                id="sub-address"
                value={state.addressLine1}
                onChange={(e) => setState((s) => ({ ...s, addressLine1: e.target.value }))}
              />
              {errors.addressLine1 && <p className="text-xs text-danger">{errors.addressLine1}</p>}
            </div>

            {adminMode && (
              <div className="space-y-1.5">
                <Label htmlFor="sub-address2">{tForm("addressLine2")}</Label>
                <Input
                  id="sub-address2"
                  value={state.addressLine2}
                  onChange={(e) => setState((s) => ({ ...s, addressLine2: e.target.value }))}
                />
              </div>
            )}

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
                <Label htmlFor="sub-region">{t("fields.region")}</Label>
                <Input
                  id="sub-region"
                  value={state.region}
                  onChange={(e) => setState((s) => ({ ...s, region: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sub-country">{t("fields.country")}</Label>
                <CountryCombobox
                  id="sub-country"
                  value={state.countryCode}
                  onChange={(code) => setState((s) => ({ ...s, countryCode: code }))}
                />
                {errors.country && <p className="text-xs text-danger">{errors.country}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-postal">{t("fields.postalCode")}</Label>
                <Input
                  id="sub-postal"
                  value={state.postalCode}
                  onChange={(e) => setState((s) => ({ ...s, postalCode: e.target.value }))}
                />
              </div>
            </div>

            {adminMode && (
              <>
                <div className="flex items-end gap-3">
                  <Button type="button" variant="secondary" onClick={runGeocode} disabled={geocodeBusy}>
                    {geocodeBusy ? <Loader2 className="animate-spin" /> : <MapPin />}
                    {geocodeBusy ? tForm("geocodeWorking") : tForm("geocode")}
                  </Button>
                  {errors.coords && <p className="text-xs text-danger">{errors.coords}</p>}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-lat">{tForm("lat")}</Label>
                    <Input
                      id="sub-lat"
                      type="number"
                      step="0.000001"
                      value={state.lat}
                      onChange={(e) => setState((s) => ({ ...s, lat: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-lng">{tForm("lng")}</Label>
                    <Input
                      id="sub-lng"
                      type="number"
                      step="0.000001"
                      value={state.lng}
                      onChange={(e) => setState((s) => ({ ...s, lng: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-tz">{tForm("timezone")}</Label>
                    <Input
                      id="sub-tz"
                      placeholder="Europe/Istanbul"
                      value={state.timezone}
                      onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))}
                    />
                    {errors.timezone && <p className="text-xs text-danger">{errors.timezone}</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === "contact" && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sub-phone">{t("fields.phone")}</Label>
                <Input
                  id="sub-phone"
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
                <Label htmlFor="sub-email">{t("fields.email")}</Label>
                <Input
                  id="sub-email"
                  type="email"
                  value={state.email}
                  onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
                />
                {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-website">{t("fields.website")}</Label>
              <Input
                id="sub-website"
                type="url"
                placeholder="https://"
                value={state.website}
                onChange={(e) => setState((s) => ({ ...s, website: e.target.value }))}
              />
              {errors.website && <p className="text-xs text-danger">{errors.website}</p>}
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

            {adminMode && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-facebook">{tForm("facebook")}</Label>
                    <Input
                      id="sub-facebook"
                      type="url"
                      value={state.facebook}
                      onChange={(e) => setState((s) => ({ ...s, facebook: e.target.value }))}
                    />
                    {errors.facebook && <p className="text-xs text-danger">{errors.facebook}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-instagram">{tForm("instagram")}</Label>
                    <Input
                      id="sub-instagram"
                      type="url"
                      value={state.instagram}
                      onChange={(e) => setState((s) => ({ ...s, instagram: e.target.value }))}
                    />
                    {errors.instagram && <p className="text-xs text-danger">{errors.instagram}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-youtube">{tForm("youtube")}</Label>
                    <Input
                      id="sub-youtube"
                      type="url"
                      value={state.youtube}
                      onChange={(e) => setState((s) => ({ ...s, youtube: e.target.value }))}
                    />
                    {errors.youtube && <p className="text-xs text-danger">{errors.youtube}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sub-whatsapp">{tForm("whatsapp")}</Label>
                    <Input
                      id="sub-whatsapp"
                      value={state.whatsapp}
                      onChange={(e) => setState((s) => ({ ...s, whatsapp: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sub-alt">{tForm("altSpellings")}</Label>
                  <Input
                    id="sub-alt"
                    value={state.altSpellings}
                    onChange={(e) => setState((s) => ({ ...s, altSpellings: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {step === "facilities" && adminMode && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{tForm("sectionFacilitiesHint")}</p>
            {facilities.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                {tForm("facilitiesEmpty")}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {facilities.map((f) => {
                  const checked = state.facilities.includes(f.slug);
                  return (
                    <label key={f.slug} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            facilities: e.target.checked
                              ? [...s.facilities, f.slug]
                              : s.facilities.filter((slug) => slug !== f.slug),
                          }))
                        }
                      />
                      {f.name}
                    </label>
                  );
                })}
              </div>
            )}
            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="sub-capacity">{tForm("capacity")}</Label>
              <Input
                id="sub-capacity"
                type="number"
                min={0}
                value={state.capacity}
                onChange={(e) => setState((s) => ({ ...s, capacity: e.target.value }))}
              />
            </div>
          </div>
        )}

        {step === "prayer" && adminMode && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{tForm("sectionPrayerHint")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-calc">{tForm("calcMethod")}</Label>
                <select
                  id="sub-calc"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={state.calcMethod}
                  onChange={(e) => {
                    prayerCalcDirty.current = true;
                    setState((s) => ({ ...s, calcMethod: e.target.value as CalcMethod }));
                  }}
                >
                  {CALC_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-asr">{tForm("asrMethod")}</Label>
                <select
                  id="sub-asr"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={state.asrMethod}
                  onChange={(e) => {
                    prayerCalcDirty.current = true;
                    setState((s) => ({ ...s, asrMethod: e.target.value as AsrMethod }));
                  }}
                >
                  <option value="shafi">Shafi / Maliki / Hanbali</option>
                  <option value="hanafi">Hanafi</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-highlat">{tForm("highLatRule")}</Label>
                <select
                  id="sub-highlat"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={state.highLatitudeRule}
                  onChange={(e) => {
                    prayerCalcDirty.current = true;
                    setState((s) => ({ ...s, highLatitudeRule: e.target.value as HighLatitudeRule }));
                  }}
                >
                  {HIGH_LAT_RULES.map((r) => (
                    <option key={r} value={r}>
                      {r === "MIDDLE_OF_NIGHT" ? "Middle of night" : r === "ANGLE_BASED" ? "Angle-based" : "One seventh"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === "media" && adminMode && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>{tForm("coverImageLabel")}</Label>
              <MosqueImageUploader
                slug={initial?.slug ?? "_new"}
                kind="cover"
                value={state.coverImageStoragePath}
                previewUrl={state.coverImageUrl}
                onChange={(next) =>
                  setState((s) => ({
                    ...s,
                    coverImageStoragePath: next?.storagePath ?? "",
                    coverImageUrl: next?.url ?? "",
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{tForm("logoLabel")}</Label>
              <MosqueImageUploader
                slug={initial?.slug ?? "_new"}
                kind="logo"
                value={state.logoStoragePath}
                previewUrl={state.logoUrl}
                onChange={(next) =>
                  setState((s) => ({
                    ...s,
                    logoStoragePath: next?.storagePath ?? "",
                    logoUrl: next?.url ?? "",
                  }))
                }
              />
            </div>
          </div>
        )}

        {step === "admin" && adminMode && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="sub-admin-status">{tQuick("adminFields.status")}</Label>
              <select
                id="sub-admin-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={state.adminStatus}
                onChange={(e) =>
                  setState((s) => ({ ...s, adminStatus: e.target.value as MosqueStatus }))
                }
              >
                {ADMIN_STATUSES.map((opt) => (
                  <option key={opt} value={opt}>
                    {tStatuses(opt)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {tQuick("adminFields.statusHintMosque")}
              </p>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <div className="space-y-0.5">
                <Label>{tForm("managers.label")}</Label>
                <p className="text-xs text-muted-foreground">{tForm("managers.hint")}</p>
              </div>
              {state.managers.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {state.managers.map((m) => (
                    <li
                      key={m.uid}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      <span className="truncate max-w-[16rem]">{m.label}</span>
                      <button
                        type="button"
                        aria-label={tForm("managers.remove")}
                        onClick={() => removeManager(m.uid)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="sub-manager-email" className="text-xs">
                    {tForm("managers.addByEmail")}
                  </Label>
                  <Input
                    id="sub-manager-email"
                    type="email"
                    value={managerEmailInput}
                    onChange={(e) => setManagerEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addManagerByEmail();
                      }
                    }}
                    placeholder={tForm("managers.emailPlaceholder")}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addManagerByEmail}
                  disabled={managerLookupBusy || managerEmailInput.trim().length === 0}
                >
                  {managerLookupBusy ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  {tForm("managers.addButton")}
                </Button>
              </div>
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
                { label: t("fields.nameEn"), value: state.nameEn },
                ...(state.nameAr ? [{ label: t("fields.nameAr"), value: state.nameAr }] : []),
                ...(adminMode && state.legalName
                  ? [{ label: tForm("legalName"), value: state.legalName }]
                  : []),
                { label: t("fields.denomination"), value: tDenominations(state.denomination) },
                ...(state.description ? [{ label: t("fields.description"), value: state.description }] : []),
              ]}
            />

            <ReviewSection
              title={t("steps.location")}
              onEdit={() => jumpToStep(STEPS.indexOf("location"))}
              editLabel={t("review.editSection", { section: t("steps.location") })}
              rows={[
                {
                  label: t("fields.addressLine1"),
                  value: [
                    state.addressLine1,
                    state.addressLine2,
                    state.city,
                    state.region,
                    state.postalCode,
                    state.countryCode,
                  ]
                    .filter(Boolean)
                    .join(", "),
                },
                ...(adminMode
                  ? [
                      {
                        label: `${tForm("lat")} / ${tForm("lng")}`,
                        value: `${state.lat || "—"}, ${state.lng || "—"}`,
                      },
                      { label: tForm("timezone"), value: state.timezone || "—" },
                    ]
                  : []),
              ]}
            />

            <ReviewSection
              title={t("steps.contact")}
              onEdit={() => jumpToStep(STEPS.indexOf("contact"))}
              editLabel={t("review.editSection", { section: t("steps.contact") })}
              rows={[
                ...(state.phone ? [{ label: t("fields.phone"), value: state.phone }] : []),
                ...(state.email ? [{ label: t("fields.email"), value: state.email }] : []),
                ...(state.website ? [{ label: t("fields.website"), value: state.website }] : []),
                ...(state.languages.length > 0
                  ? [{ label: t("fields.languages"), value: state.languages.join(", ") }]
                  : []),
                ...(adminMode && state.facebook ? [{ label: tForm("facebook"), value: state.facebook }] : []),
                ...(adminMode && state.instagram ? [{ label: tForm("instagram"), value: state.instagram }] : []),
                ...(adminMode && state.youtube ? [{ label: tForm("youtube"), value: state.youtube }] : []),
                ...(adminMode && state.whatsapp ? [{ label: tForm("whatsapp"), value: state.whatsapp }] : []),
                ...(adminMode && state.altSpellings
                  ? [{ label: tForm("altSpellings"), value: state.altSpellings }]
                  : []),
              ]}
            />

            {adminMode && (
              <>
                <ReviewSection
                  title={tForm("sectionFacilities")}
                  onEdit={() => jumpToStep(STEPS.indexOf("facilities"))}
                  editLabel={t("review.editSection", { section: tForm("sectionFacilities") })}
                  rows={[
                    {
                      label: tForm("sectionFacilities"),
                      value: state.facilities
                        .map((slug) => facilities.find((f) => f.slug === slug)?.name ?? slug)
                        .join(", ") || "—",
                    },
                    ...(state.capacity
                      ? [{ label: tForm("capacity"), value: state.capacity }]
                      : []),
                  ]}
                />
                <ReviewSection
                  title={tForm("sectionPrayer")}
                  onEdit={() => jumpToStep(STEPS.indexOf("prayer"))}
                  editLabel={t("review.editSection", { section: tForm("sectionPrayer") })}
                  rows={[
                    { label: tForm("calcMethod"), value: state.calcMethod },
                    { label: tForm("asrMethod"), value: state.asrMethod },
                    { label: tForm("highLatRule"), value: state.highLatitudeRule },
                  ]}
                />
                <ReviewSection
                  title={tForm("sectionMedia")}
                  onEdit={() => jumpToStep(STEPS.indexOf("media"))}
                  editLabel={t("review.editSection", { section: tForm("sectionMedia") })}
                  rows={[
                    ...(state.coverImageUrl
                      ? [{ label: tForm("coverImageUrl"), value: state.coverImageUrl }]
                      : []),
                    ...(state.logoUrl ? [{ label: tForm("logoUrl"), value: state.logoUrl }] : []),
                  ]}
                />
                <ReviewSection
                  title={tQuick("steps.admin")}
                  onEdit={() => jumpToStep(STEPS.indexOf("admin"))}
                  editLabel={t("review.editSection", { section: tQuick("steps.admin") })}
                  rows={[
                    { label: tQuick("adminFields.status"), value: tStatuses(state.adminStatus) },
                    {
                      label: tForm("managers.label"),
                      value:
                        state.managers.length > 0
                          ? state.managers.map((m) => m.label).join(", ")
                          : "—",
                    },
                  ]}
                />
              </>
            )}

            {!adminMode && reviewGeocode.status === "loading" && (
              <div className="h-[240px] w-full animate-pulse rounded-md bg-muted" aria-hidden />
            )}
            {!adminMode && reviewGeocode.status === "ok" && (
              <MosqueMap
                lat={reviewGeocode.lat}
                lng={reviewGeocode.lng}
                className="h-[240px] w-full overflow-hidden rounded-md"
              />
            )}
            {!adminMode && reviewGeocode.status === "fail" && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {t("review.geocodeFailed")}
              </p>
            )}
            {adminMode && state.lat && state.lng && (
              <MosqueMap
                lat={parseFloat(state.lat)}
                lng={parseFloat(state.lng)}
                className="h-[240px] w-full overflow-hidden rounded-md"
              />
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-t border-border pt-4",
          adminMode && "border-t border-border bg-card px-4 pb-4 pt-3 md:px-6",
        )}
      >
        {adminMode && (
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
        )}
        <div className="ml-auto flex items-center gap-2">
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
              {submitting ? <Loader2 className="animate-spin" /> : isEdit ? <Save /> : <Send />}
              {submitting
                ? t("actions.submitting")
                : adminMode
                  ? isEdit
                    ? tForm("actions.save")
                    : tQuick("create")
                  : t("actions.submit")}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function stepLabelFor(
  step: Step,
  t: ReturnType<typeof useTranslations>,
  tQuick: ReturnType<typeof useTranslations>,
  tForm: ReturnType<typeof useTranslations>,
): string {
  switch (step) {
    case "admin":
      return tQuick("steps.admin");
    case "facilities":
      return tForm("sectionFacilities");
    case "prayer":
      return tForm("sectionPrayer");
    case "media":
      return tForm("sectionMedia");
    default:
      return t(`steps.${step}`);
  }
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
