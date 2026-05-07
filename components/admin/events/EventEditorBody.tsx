"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EditorDialogBody,
  EditorDialogDescription,
  EditorDialogFooter,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { Field, FormGrid, Section } from "@/components/admin/ui/form-layout";
import { toast } from "@/components/ui/sonner";
import { MosqueCombobox, type MosqueOption } from "@/components/common/MosqueCombobox";
import {
  createEventAction,
  updateEventAction,
  type EventInput,
} from "@/lib/admin/actions/events";
import { buildRRule } from "@/lib/admin/recurrence";
import { resolveCategoryName } from "@/lib/events/categories";
import type {
  AdminEvent,
  EventCategory,
  EventLocationMode,
  EventStatus,
  PrayerAnchor,
} from "@/types/admin";
import type { EventCategoryDoc } from "@/types/event-category";

const STATUSES: EventStatus[] = ["draft", "published", "cancelled"];
const LOCATION_MODES: EventLocationMode[] = ["in-person", "online", "hybrid"];
const PRAYER_ANCHORS: PrayerAnchor[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

type RecurrenceMode = "none" | "weekly" | "daily" | "monthly" | "hijri-anchor";

type FormValues = {
  title: string;
  description: string;
  category: EventCategory;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationMode: EventLocationMode;
  venue: string;
  address: string;
  url: string;
  organizerName: string;
  organizerContact: string;
  capacity: string;
  mosqueId: string;
  recurrenceMode: RecurrenceMode;
  recurrenceCount: string;
  hijriMonth: string;
  hijriDay: string;
  prayerAnchorEnabled: boolean;
  prayerAnchor: PrayerAnchor;
  prayerOffsetMinutes: string;
};

interface Props {
  event?: AdminEvent | null;
  canPersist: boolean;
  categories: EventCategoryDoc[];
  /** All mosques (admin scope) the editor can attach the event to. */
  mosques: MosqueOption[];
  onSaved: (saved: AdminEvent, mode: "create" | "update") => void;
  onCancel: () => void;
  /** Optional left-aligned header element (e.g. Quick Create back button). */
  headerLeading?: React.ReactNode;
}

function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function detectRecurrenceMode(event?: AdminEvent | null): RecurrenceMode {
  if (!event) return "none";
  if (event.hijriAnchor) return "hijri-anchor";
  if (event.recurrence?.includes("FREQ=WEEKLY")) return "weekly";
  if (event.recurrence?.includes("FREQ=DAILY")) return "daily";
  if (event.recurrence?.includes("FREQ=MONTHLY")) return "monthly";
  return "none";
}

function detectRecurrenceCount(rrule?: string): string {
  if (!rrule) return "";
  const match = /COUNT=(\d+)/.exec(rrule);
  return match ? match[1]! : "";
}

function defaultsFromEvent(
  event: AdminEvent | null | undefined,
  fallbackCategory: EventCategory,
): FormValues {
  const tz =
    event?.timezone ??
    (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    category: event?.category ?? fallbackCategory,
    status: event?.status ?? "draft",
    startsAt: isoToLocalInput(event?.startsAt),
    endsAt: isoToLocalInput(event?.endsAt),
    timezone: tz,
    locationMode: event?.location.mode ?? "in-person",
    venue: event?.location.venue ?? "",
    address: event?.location.address ?? "",
    url: event?.location.url ?? "",
    organizerName: event?.organizer.name ?? "",
    organizerContact: event?.organizer.contact ?? "",
    capacity: event?.capacity != null ? String(event.capacity) : "",
    mosqueId: event?.mosqueId ?? "",
    recurrenceMode: detectRecurrenceMode(event),
    recurrenceCount: detectRecurrenceCount(event?.recurrence),
    hijriMonth: event?.hijriAnchor?.monthIndex != null ? String(event.hijriAnchor.monthIndex) : "9",
    hijriDay: event?.hijriAnchor?.day != null ? String(event.hijriAnchor.day) : "1",
    prayerAnchorEnabled: Boolean(event?.startAnchor),
    prayerAnchor: event?.startAnchor?.prayer ?? "maghrib",
    prayerOffsetMinutes:
      event?.startAnchor?.offsetMinutes != null
        ? String(event.startAnchor.offsetMinutes)
        : "0",
  };
}

export function EventEditorBody({
  event,
  canPersist,
  categories,
  mosques,
  onSaved,
  onCancel,
  headerLeading,
}: Props) {
  const t = useTranslations("events.editor");
  const tStatuses = useTranslations("events.statuses");
  const tLocations = useTranslations("events.locationModes");
  const tRecurrence = useTranslations("events.recurrence");
  const tPrayerNames = useTranslations("prayerTimes");
  const tHijriMonths = useTranslations("hijri.months");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const editing = Boolean(event);

  const activeCategories = useMemo(
    () =>
      [...categories]
        .filter((c) => c.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const fallbackCategory: EventCategory = activeCategories[0]?.slug ?? "other";

  const schema = useMemo(
    () =>
      z
        .object({
          title: z.string().min(2, t("errorTitle")),
          description: z.string(),
          category: z.string().min(1),
          status: z.enum(STATUSES as [EventStatus, ...EventStatus[]]),
          startsAt: z.string().min(1, t("errorStartsAt")),
          endsAt: z.string(),
          timezone: z.string().min(1, t("errorTimezone")),
          locationMode: z.enum(
            LOCATION_MODES as [EventLocationMode, ...EventLocationMode[]],
          ),
          venue: z.string(),
          address: z.string(),
          url: z
            .string()
            .refine((v) => !v || /^https?:\/\//i.test(v), { message: t("errorUrl") }),
          organizerName: z.string().min(1, t("errorOrganizer")),
          organizerContact: z.string(),
          capacity: z
            .string()
            .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 0), {
              message: t("errorCapacity"),
            }),
          mosqueId: z.string(),
          recurrenceMode: z.enum(["none", "weekly", "daily", "monthly", "hijri-anchor"]),
          recurrenceCount: z
            .string()
            .refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 999), {
              message: t("errorRecurrenceCount"),
            }),
          hijriMonth: z.string(),
          hijriDay: z.string(),
          prayerAnchorEnabled: z.boolean(),
          prayerAnchor: z.enum(["fajr", "dhuhr", "asr", "maghrib", "isha"]),
          prayerOffsetMinutes: z
            .string()
            .refine((v) => !v || /^-?\d+$/.test(v), {
              message: t("errorOffsetMinutes"),
            }),
        })
        .refine(
          (v) => !v.endsAt || new Date(v.endsAt).getTime() >= new Date(v.startsAt).getTime(),
          { message: t("errorEndsAfterStart"), path: ["endsAt"] },
        )
        .refine(
          (v) => v.locationMode === "online" || Boolean(v.venue.trim()),
          { message: t("errorVenue"), path: ["venue"] },
        )
        .refine(
          (v) => v.locationMode === "in-person" || Boolean(v.url.trim()),
          { message: t("errorMeetingUrl"), path: ["url"] },
        ),
    [t],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFromEvent(event, fallbackCategory),
  });

  useEffect(() => {
    reset(defaultsFromEvent(event, fallbackCategory));
  }, [event, reset, fallbackCategory]);

  const locationMode = watch("locationMode");
  const recurrenceMode = watch("recurrenceMode");
  const prayerAnchorEnabled = watch("prayerAnchorEnabled");
  const mosqueId = watch("mosqueId");

  async function onSubmit(values: FormValues) {
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }

    const startsAtIso = localInputToIso(values.startsAt);
    const startsAtDate = new Date(startsAtIso);

    let recurrence: string | undefined;
    let hijriAnchor: EventInput["hijriAnchor"];
    if (values.recurrenceMode === "weekly") {
      recurrence = buildRRule(
        "weekly",
        startsAtDate,
        values.recurrenceCount ? Number(values.recurrenceCount) : undefined,
      );
    } else if (values.recurrenceMode === "daily") {
      recurrence = buildRRule(
        "daily",
        startsAtDate,
        values.recurrenceCount ? Number(values.recurrenceCount) : undefined,
      );
    } else if (values.recurrenceMode === "monthly") {
      recurrence = buildRRule(
        "monthly",
        startsAtDate,
        values.recurrenceCount ? Number(values.recurrenceCount) : undefined,
      );
    } else if (values.recurrenceMode === "hijri-anchor") {
      hijriAnchor = {
        monthIndex: Math.min(12, Math.max(1, Number(values.hijriMonth) || 1)),
        day: Math.min(30, Math.max(1, Number(values.hijriDay) || 1)),
        hourLocal: startsAtDate.getHours(),
        minuteLocal: startsAtDate.getMinutes(),
      };
    }

    const startAnchor = values.prayerAnchorEnabled
      ? {
          prayer: values.prayerAnchor,
          offsetMinutes: values.prayerOffsetMinutes ? Number(values.prayerOffsetMinutes) : 0,
        }
      : undefined;

    const input: EventInput = {
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      category: values.category,
      status: values.status,
      startsAt: startsAtIso,
      endsAt: values.endsAt ? localInputToIso(values.endsAt) : undefined,
      timezone: values.timezone,
      location: {
        mode: values.locationMode,
        venue: values.venue.trim() || undefined,
        address: values.address.trim() || undefined,
        url: values.url.trim() || undefined,
      },
      organizer: {
        name: values.organizerName.trim(),
        contact: values.organizerContact.trim() || undefined,
      },
      capacity: values.capacity ? Number(values.capacity) : undefined,
      mosqueId: values.mosqueId || undefined,
      recurrence,
      hijriAnchor,
      startAnchor,
    };

    setSubmitting(true);
    try {
      const result = editing && event
        ? await updateEventAction(event.id, input)
        : await createEventAction(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onSaved(result.data, editing ? "update" : "create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
      <EditorDialogHeader>
        {headerLeading}
        <EditorDialogTitle>{editing ? t("editTitle") : t("createTitle")}</EditorDialogTitle>
        <EditorDialogDescription>
          {editing ? t("editDescription") : t("createDescription")}
        </EditorDialogDescription>
      </EditorDialogHeader>
      <EditorDialogBody className="space-y-5">
        <Section title={t("sectionBasics")}>
          <Field label={t("title")} error={errors.title?.message} required>
            <Input id="evt-title" autoComplete="off" {...register("title")} />
          </Field>
          <FormGrid>
            <Field label={t("category")}>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                {...register("category")}
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {resolveCategoryName(c.slug, categories, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("status")}>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                {...register("status")}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{tStatuses(s)}</option>
                ))}
              </select>
            </Field>
          </FormGrid>
          <Field label={t("description")}>
            <textarea
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register("description")}
            />
          </Field>
        </Section>

        <Section title={t("sectionWhen")}>
          <FormGrid cols={3}>
            <Field label={t("startsAt")} error={errors.startsAt?.message} required>
              <Input id="evt-starts-at" type="datetime-local" {...register("startsAt")} />
            </Field>
            <Field label={t("endsAt")} error={errors.endsAt?.message}>
              <Input id="evt-ends-at" type="datetime-local" {...register("endsAt")} />
            </Field>
            <Field label={t("timezone")} error={errors.timezone?.message} hint={t("timezoneHint")}>
              <Input id="evt-tz" autoComplete="off" {...register("timezone")} />
            </Field>
          </FormGrid>

          <FormGrid>
            <Field label={tRecurrence("modeLabel")} hint={tRecurrence("modeHint")}>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                {...register("recurrenceMode")}
              >
                <option value="none">{tRecurrence("none")}</option>
                <option value="weekly">{tRecurrence("weekly")}</option>
                <option value="daily">{tRecurrence("daily")}</option>
                <option value="monthly">{tRecurrence("monthly")}</option>
                <option value="hijri-anchor">{tRecurrence("hijriAnchor")}</option>
              </select>
            </Field>
            {(recurrenceMode === "weekly" ||
              recurrenceMode === "daily" ||
              recurrenceMode === "monthly") && (
              <Field
                label={tRecurrence("countLabel")}
                hint={tRecurrence("countHint")}
                error={errors.recurrenceCount?.message}
              >
                <Input
                  id="evt-rec-count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  placeholder={tRecurrence("countPlaceholder")}
                  {...register("recurrenceCount")}
                />
              </Field>
            )}
          </FormGrid>

          {recurrenceMode === "hijri-anchor" && (
            <FormGrid>
              <Field label={tRecurrence("hijriMonthLabel")}>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  {...register("hijriMonth")}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{tHijriMonths(String(m))}</option>
                  ))}
                </select>
              </Field>
              <Field label={tRecurrence("hijriDayLabel")}>
                <Input
                  id="evt-hijri-day"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={30}
                  {...register("hijriDay")}
                />
              </Field>
            </FormGrid>
          )}

          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...register("prayerAnchorEnabled")} />
              <span>
                <span className="font-medium text-foreground">
                  {tRecurrence("prayerAnchorLabel")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {tRecurrence("prayerAnchorHint")}
                </span>
              </span>
            </label>
            {prayerAnchorEnabled && (
              <FormGrid>
                <Field label={tRecurrence("prayerLabel")}>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    {...register("prayerAnchor")}
                  >
                    {PRAYER_ANCHORS.map((p) => (
                      <option key={p} value={p}>{tPrayerNames(p)}</option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={tRecurrence("offsetLabel")}
                  hint={tRecurrence("offsetHint")}
                  error={errors.prayerOffsetMinutes?.message}
                >
                  <Input
                    id="evt-prayer-offset"
                    type="number"
                    inputMode="numeric"
                    {...register("prayerOffsetMinutes")}
                  />
                </Field>
              </FormGrid>
            )}
          </div>
        </Section>

        <Section title={t("sectionWhere")}>
          <FormGrid>
            <Field label={t("locationMode")}>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                {...register("locationMode")}
              >
                {LOCATION_MODES.map((m) => (
                  <option key={m} value={m}>{tLocations(m)}</option>
                ))}
              </select>
            </Field>
            {locationMode !== "in-person" && (
              <Field label={t("meetingUrl")} error={errors.url?.message}>
                <Input
                  id="evt-url"
                  type="url"
                  placeholder="https://"
                  autoComplete="off"
                  {...register("url")}
                />
              </Field>
            )}
          </FormGrid>
          {locationMode !== "online" && (
            <FormGrid>
              <Field label={t("venue")} error={errors.venue?.message}>
                <Input id="evt-venue" autoComplete="off" {...register("venue")} />
              </Field>
              <Field label={t("address")}>
                <Input id="evt-address" autoComplete="off" {...register("address")} />
              </Field>
            </FormGrid>
          )}
        </Section>

        <Section title={t("sectionOrganizer")}>
          <FormGrid cols={3}>
            <Field label={t("organizerName")} error={errors.organizerName?.message} required>
              <Input id="evt-org" autoComplete="off" {...register("organizerName")} />
            </Field>
            <Field label={t("organizerContact")}>
              <Input id="evt-org-contact" autoComplete="off" {...register("organizerContact")} />
            </Field>
            <Field label={t("capacity")} error={errors.capacity?.message} hint={t("capacityHint")}>
              <Input
                id="evt-capacity"
                type="number"
                inputMode="numeric"
                min={0}
                {...register("capacity")}
              />
            </Field>
          </FormGrid>
          <Field label={t("mosque")} hint={t("mosqueHint")}>
            <MosqueCombobox
              id="evt-mosque"
              value={mosqueId || undefined}
              onChange={(slug) =>
                setValue("mosqueId", slug ?? "", { shouldDirty: true })
              }
              options={mosques}
            />
          </Field>
        </Section>

        {!canPersist && (
          <p className="text-xs text-warning">{t("noPersistNote")}</p>
        )}
      </EditorDialogBody>

      <EditorDialogFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={submitting || !canPersist} aria-busy={submitting}>
          {submitting ? tCommon("working") : <><Save /> {editing ? t("save") : t("create")}</>}
        </Button>
      </EditorDialogFooter>
    </form>
  );
}
