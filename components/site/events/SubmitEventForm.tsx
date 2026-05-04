"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Lightbulb,
  Loader2,
  Lock,
  Pencil,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { suggestTimezoneForCountry } from "@/lib/events/country-tz";
import { buildIcs } from "@/lib/events/ics";
import { createEventAction, type EventInput } from "@/lib/admin/actions/events";
import type {
  AdminEvent,
  EventCategory,
  EventLocationMode,
  EventStatus,
} from "@/types/admin";

const PUBLIC_STEPS = ["basics", "when", "where", "who", "review"] as const;
const ADMIN_STEPS = ["basics", "when", "where", "who", "admin", "review"] as const;
type Step = (typeof ADMIN_STEPS)[number];

const CATEGORIES: EventCategory[] = [
  "prayer",
  "lecture",
  "iftar",
  "janazah",
  "class",
  "fundraiser",
  "community",
  "other",
];

const LOCATION_MODES: EventLocationMode[] = ["in-person", "online", "hybrid"];
const RECURRENCE_PRESETS = ["none", "weekly", "monthly"] as const;
type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

const ADMIN_STATUSES: EventStatus[] = ["draft", "published", "cancelled"];

const CATEGORIES_WITH_HINTS: ReadonlySet<EventCategory> = new Set([
  "janazah",
  "iftar",
  "lecture",
  "class",
  "fundraiser",
]);

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

interface FormState {
  title: string;
  description: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  timezone: string;
  recurrence: RecurrencePreset;
  locationMode: EventLocationMode;
  venue: string;
  address: string;
  country: string;
  url: string;
  platform: string;
  dialIn: string;
  organizerName: string;
  organizerContact: string;
  submitterEmail: string;
  // Admin-only — surfaced when adminMode is true.
  adminStatus: EventStatus;
  // honeypot
  website_url_secondary: string;
}

function makeEmpty(email: string): FormState {
  const tz =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  return {
    title: "",
    description: "",
    category: "community",
    startsAt: "",
    endsAt: "",
    timezone: tz || "UTC",
    recurrence: "none",
    locationMode: "in-person",
    venue: "",
    address: "",
    country: "",
    url: "",
    platform: "",
    dialIn: "",
    organizerName: "",
    organizerContact: "",
    submitterEmail: email,
    adminStatus: "draft",
    website_url_secondary: "",
  };
}

interface ValidationResult {
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

interface SubmitEventFormProps {
  userEmail: string;
  /** When true, skip honeypot/submitter-email/sessionStorage and submit via the admin server action. */
  adminMode?: boolean;
  onAdminSaved?: (result: { id: string }) => void;
  onAdminCancel?: () => void;
}

export function SubmitEventForm({
  userEmail,
  adminMode = false,
  onAdminSaved,
  onAdminCancel,
}: SubmitEventFormProps) {
  const t = useTranslations("eventsPublic.submit");
  const tCategories = useTranslations("events.categories");
  const tStatuses = useTranslations("events.statuses");
  const tQuick = useTranslations("quickCreate");

  const STEPS: readonly Step[] = adminMode ? ADMIN_STEPS : PUBLIC_STEPS;

  const [state, setState] = useState<FormState>(() => makeEmpty(userEmail));
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [submitted, setSubmitted] = useState<FormState | null>(null);
  const [tzSuggestion, setTzSuggestion] = useState<string | null>(null);
  const timezoneTouched = useRef(false);

  function setTimezoneFromUser(tz: string) {
    timezoneTouched.current = true;
    setTzSuggestion(null);
    setState((s) => ({ ...s, timezone: tz }));
  }

  function setCountry(code: string) {
    setState((s) => ({ ...s, country: code }));
    if (timezoneTouched.current) return;
    const suggested = suggestTimezoneForCountry(code);
    if (suggested && suggested !== state.timezone) {
      setState((s) => ({ ...s, country: code, timezone: suggested }));
      setTzSuggestion(suggested);
    }
  }

  // Pin "now" so the past-time warning is computed once per mount instead of on
  // every render — keeps the validate function pure for the React Compiler. The
  // warning is informational; we don't need it to tick over while the user types.
  const [renderNow] = useState(() => Date.now());

  const validate = useCallback(
    (step: Step, s: FormState, now: number): ValidationResult => {
      const errs: Record<string, string> = {};
      const warns: Record<string, string> = {};
      if (step === "basics") {
        if (s.title.trim().length < 2) errs.title = t("validation.titleRequired");
      }
      if (step === "when") {
        if (!s.startsAt) {
          errs.startsAt = t("validation.startRequired");
        } else {
          const startMs = new Date(s.startsAt).getTime();
          if (Number.isFinite(startMs) && startMs < now) {
            warns.startsAt = t("validation.startInPast");
          }
          if (s.endsAt) {
            const endMs = new Date(s.endsAt).getTime();
            if (Number.isFinite(endMs)) {
              if (endMs < startMs) {
                errs.endsAt = t("validation.endsBeforeStart");
              } else if (endMs - startMs > MAX_DURATION_MS) {
                warns.endsAt = t("validation.maxDuration");
              }
            }
          }
        }
      }
      if (step === "where") {
        if (s.locationMode !== "online" && !s.venue.trim() && !s.address.trim()) {
          errs.venue = t("validation.venueRequired");
        }
        if (s.locationMode !== "in-person" && !s.url.trim()) {
          errs.url = t("validation.urlRequired");
        }
      }
      if (step === "who") {
        if (!s.organizerName.trim()) errs.organizerName = t("validation.organizerRequired");
        if (!adminMode && !/^.+@.+\..+$/.test(s.submitterEmail.trim())) {
          errs.submitterEmail = t("validation.submitterEmailRequired");
        }
      }
      // No validation for "admin" — status is a select with a default.
      return { errors: errs, warnings: warns };
    },
    [t, adminMode],
  );

  const liveStep = STEPS[stepIdx]!;
  const liveValidation = useMemo(
    () => validate(liveStep, state, renderNow),
    [liveStep, state, renderNow, validate],
  );
  const stepBlocked = Object.keys(liveValidation.errors).length > 0;

  function handleNext() {
    const result = validate(liveStep, state, Date.now());
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) {
      toast.error(t("validation.fixStep"));
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

  function buildSyntheticEvent(s: FormState): AdminEvent {
    const nowIso = new Date().toISOString();
    return {
      id: "submitted-preview",
      title: s.title,
      description: s.description || undefined,
      category: s.category,
      status: "draft",
      startsAt: new Date(s.startsAt).toISOString(),
      endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : undefined,
      timezone: s.timezone,
      location: {
        mode: s.locationMode,
        venue: s.venue || undefined,
        address: s.address || undefined,
        url: s.url || undefined,
        platform: s.platform || undefined,
        dialIn: s.dialIn || undefined,
      },
      organizer: {
        name: s.organizerName,
        contact: s.organizerContact || undefined,
      },
      rsvpCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  function buildAdminInput(s: FormState): EventInput {
    return {
      title: s.title.trim(),
      description: s.description.trim() || undefined,
      category: s.category,
      status: s.adminStatus,
      startsAt: new Date(s.startsAt).toISOString(),
      endsAt: s.endsAt ? new Date(s.endsAt).toISOString() : undefined,
      timezone: s.timezone,
      location: {
        mode: s.locationMode,
        venue: s.venue.trim() || undefined,
        address: s.address.trim() || undefined,
        url: s.url.trim() || undefined,
        platform: s.platform.trim() || undefined,
        dialIn: s.dialIn.trim() || undefined,
      },
      organizer: {
        name: s.organizerName.trim(),
        contact: s.organizerContact.trim() || undefined,
      },
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const submitNow = Date.now();
    for (let i = 0; i < STEPS.length; i += 1) {
      const step = STEPS[i]!;
      const result = validate(step, state, submitNow);
      if (Object.keys(result.errors).length > 0) {
        setErrors(result.errors);
        setStepIdx(i);
        toast.error(t("validation.fixStep"));
        return;
      }
    }
    setSubmitting(true);
    try {
      if (adminMode) {
        const result = await createEventAction(buildAdminInput(state));
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(t("success.headline"));
        onAdminSaved?.({ id: result.data.id });
        return;
      }

      const payload = {
        title: state.title,
        description: state.description || undefined,
        category: state.category,
        startsAt: new Date(state.startsAt).toISOString(),
        endsAt: state.endsAt ? new Date(state.endsAt).toISOString() : undefined,
        timezone: state.timezone,
        recurrence: state.recurrence === "none" ? undefined : state.recurrence,
        location: {
          mode: state.locationMode,
          venue: state.venue || undefined,
          address: state.address || undefined,
          country: state.country || undefined,
          url: state.url || undefined,
          platform: state.platform || undefined,
          dialIn: state.dialIn || undefined,
        },
        organizer: {
          name: state.organizerName,
          contact: state.organizerContact || undefined,
        },
        submitterEmail: state.submitterEmail,
        website_url_secondary: state.website_url_secondary,
      };

      const res = await fetch("/api/events/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.status === 401) {
        toast.error(t("errorAuth"));
        return;
      }
      if (res.status === 429) {
        toast.error(t("errorRate"));
        return;
      }
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? t("errorGeneric"));
        return;
      }
      toast.success(t("success.headline"));
      setSubmitted({ ...state });
      setState(makeEmpty(userEmail));
      timezoneTouched.current = false;
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done && submitted && !adminMode) {
    return <SuccessPanel state={submitted} buildSyntheticEvent={buildSyntheticEvent} />;
  }

  const isLast = stepIdx === STEPS.length - 1;
  const showVenueFields = state.locationMode !== "online";
  const showOnlineFields = state.locationMode !== "in-person";

  return (
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

      <ol className="flex flex-wrap items-center gap-2 text-xs">
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

      {liveStep === "basics" && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="evt-title">{t("fields.title")}</Label>
            <Input
              id="evt-title"
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            />
            {errors.title && <p className="text-xs text-danger">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evt-description">{t("fields.description")}</Label>
            <textarea
              id="evt-description"
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={state.description}
              onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
              maxLength={2000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evt-category">{t("fields.category")}</Label>
            <select
              id="evt-category"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.category}
              onChange={(e) => setState((s) => ({ ...s, category: e.target.value as EventCategory }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tCategories(c)}
                </option>
              ))}
            </select>
            {CATEGORIES_WITH_HINTS.has(state.category) && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-accent/30 bg-accent/5 p-3 text-xs text-foreground">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent" />
                <p>
                  <span className="font-semibold">{t("helpers.categoryHintPrefix")} </span>
                  {t(`categoryHints.${state.category}` as `categoryHints.janazah`)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {liveStep === "when" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="evt-starts">{t("fields.startsAt")}</Label>
              <Input
                id="evt-starts"
                type="datetime-local"
                value={state.startsAt}
                onChange={(e) => setState((s) => ({ ...s, startsAt: e.target.value }))}
              />
              {errors.startsAt && <p className="text-xs text-danger">{errors.startsAt}</p>}
              {!errors.startsAt && liveValidation.warnings.startsAt && (
                <p className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="size-3" />
                  {liveValidation.warnings.startsAt}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-ends">{t("fields.endsAt")}</Label>
              <Input
                id="evt-ends"
                type="datetime-local"
                value={state.endsAt}
                onChange={(e) => setState((s) => ({ ...s, endsAt: e.target.value }))}
              />
              {errors.endsAt && <p className="text-xs text-danger">{errors.endsAt}</p>}
              {!errors.endsAt && liveValidation.warnings.endsAt && (
                <p className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="size-3" />
                  {liveValidation.warnings.endsAt}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evt-timezone">{t("fields.timezone")}</Label>
            <Input
              id="evt-timezone"
              value={state.timezone}
              onChange={(e) => setTimezoneFromUser(e.target.value)}
            />
            {tzSuggestion && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="size-3 text-accent" />
                {t("helpers.timezoneSuggested", { tz: tzSuggestion })}
              </p>
            )}
          </div>

          {!adminMode && (
            <div className="space-y-1.5">
              <Label htmlFor="evt-recurrence">{t("fields.recurrence")}</Label>
              <select
                id="evt-recurrence"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={state.recurrence}
                onChange={(e) =>
                  setState((s) => ({ ...s, recurrence: e.target.value as RecurrencePreset }))
                }
              >
                {RECURRENCE_PRESETS.map((r) => (
                  <option key={r} value={r}>
                    {t(`recurrencePresets.${r}`)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {liveStep === "where" && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="evt-location-mode">{t("fields.locationMode")}</Label>
            <select
              id="evt-location-mode"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.locationMode}
              onChange={(e) =>
                setState((s) => ({ ...s, locationMode: e.target.value as EventLocationMode }))
              }
            >
              {LOCATION_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`locationModes.${m}`)}
                </option>
              ))}
            </select>
          </div>

          {showVenueFields && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="evt-venue">{t("fields.venue")}</Label>
                  <Input
                    id="evt-venue"
                    value={state.venue}
                    onChange={(e) => setState((s) => ({ ...s, venue: e.target.value }))}
                  />
                  {errors.venue && <p className="text-xs text-danger">{errors.venue}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evt-address">{t("fields.address")}</Label>
                  <Input
                    id="evt-address"
                    value={state.address}
                    onChange={(e) => setState((s) => ({ ...s, address: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evt-country">{t("fields.country")}</Label>
                <CountryCombobox
                  id="evt-country"
                  value={state.country}
                  onChange={(code) => setCountry(code)}
                />
              </div>
            </>
          )}

          {showOnlineFields && (
            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="evt-url">{t("fields.url")}</Label>
                <Input
                  id="evt-url"
                  type="url"
                  placeholder="https://"
                  value={state.url}
                  onChange={(e) => setState((s) => ({ ...s, url: e.target.value }))}
                />
                {errors.url && <p className="text-xs text-danger">{errors.url}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="evt-platform">{t("fields.platform")}</Label>
                  <Input
                    id="evt-platform"
                    placeholder={t("placeholders.platform")}
                    value={state.platform}
                    onChange={(e) => setState((s) => ({ ...s, platform: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evt-dialin">{t("fields.dialIn")}</Label>
                  <Input
                    id="evt-dialin"
                    placeholder={t("placeholders.dialIn")}
                    value={state.dialIn}
                    onChange={(e) => setState((s) => ({ ...s, dialIn: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {liveStep === "who" && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="evt-organizer">{t("fields.organizerName")}</Label>
            <Input
              id="evt-organizer"
              value={state.organizerName}
              onChange={(e) => setState((s) => ({ ...s, organizerName: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">{t("helpers.organizerName")}</p>
            {errors.organizerName && (
              <p className="text-xs text-danger">{errors.organizerName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evt-contact">{t("fields.organizerContact")}</Label>
            <Input
              id="evt-contact"
              placeholder={t("placeholders.organizerContact")}
              value={state.organizerContact}
              onChange={(e) => setState((s) => ({ ...s, organizerContact: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">{t("helpers.organizerContact")}</p>
          </div>
          {!adminMode && (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
              <Label htmlFor="evt-submitter" className="flex items-center gap-1.5">
                <Lock className="size-3 text-muted-foreground" />
                {t("fields.submitterEmail")}
              </Label>
              <Input
                id="evt-submitter"
                type="email"
                value={state.submitterEmail}
                onChange={(e) => setState((s) => ({ ...s, submitterEmail: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t("helpers.submitterEmail")}</p>
              {errors.submitterEmail && (
                <p className="text-xs text-danger">{errors.submitterEmail}</p>
              )}
            </div>
          )}
        </div>
      )}

      {liveStep === "admin" && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="evt-admin-status">{tQuick("adminFields.status")}</Label>
            <select
              id="evt-admin-status"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.adminStatus}
              onChange={(e) =>
                setState((s) => ({ ...s, adminStatus: e.target.value as EventStatus }))
              }
            >
              {ADMIN_STATUSES.map((opt) => (
                <option key={opt} value={opt}>
                  {tStatuses(opt)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{tQuick("adminFields.statusHintEvent")}</p>
          </div>
        </div>
      )}

      {liveStep === "review" && (
        <div className="space-y-5">
          <ReviewSection
            title={t("steps.basics")}
            onEdit={() => jumpToStep(STEPS.indexOf("basics"))}
            editLabel={t("review.editStep")}
            rows={[
              { label: t("fields.title"), value: state.title },
              { label: t("fields.description"), value: state.description },
              { label: t("fields.category"), value: tCategories(state.category) },
            ]}
          />

          <ReviewSection
            title={t("steps.when")}
            onEdit={() => jumpToStep(STEPS.indexOf("when"))}
            editLabel={t("review.editStep")}
            rows={[
              {
                label: t("fields.startsAt"),
                value: state.startsAt ? new Date(state.startsAt).toLocaleString() : "",
              },
              ...(state.endsAt
                ? [{ label: t("fields.endsAt"), value: new Date(state.endsAt).toLocaleString() }]
                : []),
              { label: t("fields.timezone"), value: state.timezone },
              ...(adminMode
                ? []
                : [{ label: t("fields.recurrence"), value: t(`recurrencePresets.${state.recurrence}`) }]),
            ]}
          />

          <ReviewSection
            title={t("steps.where")}
            onEdit={() => jumpToStep(STEPS.indexOf("where"))}
            editLabel={t("review.editStep")}
            rows={[
              { label: t("fields.locationMode"), value: t(`locationModes.${state.locationMode}`) },
              ...(state.venue ? [{ label: t("fields.venue"), value: state.venue }] : []),
              ...(state.address ? [{ label: t("fields.address"), value: state.address }] : []),
              ...(state.country ? [{ label: t("fields.country"), value: state.country }] : []),
              ...(state.url ? [{ label: t("fields.url"), value: state.url }] : []),
              ...(state.platform ? [{ label: t("fields.platform"), value: state.platform }] : []),
              ...(state.dialIn ? [{ label: t("fields.dialIn"), value: state.dialIn }] : []),
            ]}
          />

          <section className="rounded-md border border-border bg-card p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{adminMode ? t("steps.who") : t("review.publicSection")}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => jumpToStep(STEPS.indexOf("who"))}
              >
                <Pencil /> {t("review.editStep")}
              </Button>
            </header>
            <dl className="grid gap-1 text-sm">
              <ReviewRow label={t("fields.organizerName")} value={state.organizerName} />
              {state.organizerContact && (
                <ReviewRow label={t("fields.organizerContact")} value={state.organizerContact} />
              )}
            </dl>
          </section>

          {adminMode ? (
            <ReviewSection
              title={tQuick("steps.admin")}
              onEdit={() => jumpToStep(STEPS.indexOf("admin"))}
              editLabel={t("review.editStep")}
              rows={[{ label: tQuick("adminFields.status"), value: tStatuses(state.adminStatus) }]}
            />
          ) : (
            <section className="rounded-md border border-warning/30 bg-warning/5 p-4">
              <header className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Lock className="size-3.5 text-warning" />
                  {t("review.privateSection")}
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => jumpToStep(STEPS.indexOf("who"))}>
                  <Pencil /> {t("review.editStep")}
                </Button>
              </header>
              <dl className="grid gap-1 text-sm">
                <ReviewRow label={t("fields.submitterEmail")} value={state.submitterEmail} />
              </dl>
            </section>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
            <Button
              type="button"
              onClick={handleNext}
              disabled={stepBlocked}
              title={stepBlocked ? t("validation.fixStep") : undefined}
            >
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
          <ReviewRow key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-line break-words">{value || "—"}</dd>
    </div>
  );
}

function SuccessPanel({
  state,
  buildSyntheticEvent,
}: {
  state: FormState;
  buildSyntheticEvent: (s: FormState) => AdminEvent;
}) {
  const t = useTranslations("eventsPublic.submit");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousTitle = document.title;
    document.title = t("success.tabTitle", { title: state.title });
    return () => {
      document.title = previousTitle;
    };
  }, [t, state.title]);

  function handleDownloadIcs() {
    if (typeof window === "undefined") return;
    const event = buildSyntheticEvent(state);
    const ics = buildIcs(event, window.location.origin);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(state.title) || "event"}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const startDate = state.startsAt ? new Date(state.startsAt) : null;
  const startsLine =
    startDate && Number.isFinite(startDate.getTime())
      ? t("success.startsAtLine", {
          when: startDate.toLocaleString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          tz: state.timezone,
        })
      : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-base font-medium text-foreground">{t("success.headline")}</p>
      {state.title && <p className="text-lg font-semibold">{state.title}</p>}
      {startsLine && (
        <p className="text-sm text-muted-foreground tabular-nums">{startsLine}</p>
      )}
      <div className="flex flex-col items-center gap-2">
        <Button type="button" variant="secondary" onClick={handleDownloadIcs}>
          <CalendarPlus /> {t("success.downloadIcs")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("success.icsHint")}</p>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
