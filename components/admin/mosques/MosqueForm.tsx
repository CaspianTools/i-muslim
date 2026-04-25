"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, MapPin, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IqamahRule, Mosque, MosqueServices } from "@/types/mosque";
import { SERVICE_KEYS, DENOMINATIONS, emptyServices, PRAYER_KEYS } from "@/lib/mosques/constants";
import { defaultPrayerCalc } from "@/lib/mosques/adhan";
import { createMosque, updateMosque, type MosqueInput } from "@/app/(admin)/admin/mosques/actions";

interface MosqueFormProps {
  mode: "create" | "edit";
  initial?: Mosque;
}

type FormState = MosqueInput;

function emptyForm(): FormState {
  return {
    name: { en: "", ar: "", tr: "", id: "" },
    legalName: "",
    denomination: "unspecified",
    description: { en: "", ar: "", tr: "", id: "" },
    address: { line1: "", line2: "", postalCode: "" },
    city: "",
    region: "",
    country: "",
    location: { lat: 0, lng: 0 },
    timezone: "",
    contact: { phone: "", email: "", website: "" },
    social: { facebook: "", instagram: "", youtube: "", whatsapp: "" },
    capacity: undefined,
    services: emptyServices(),
    languages: [],
    altSpellings: [],
    prayerCalc: defaultPrayerCalc(),
    iqamah: { fajr: undefined, dhuhr: undefined, jumuah: undefined, asr: undefined, maghrib: undefined, isha: undefined },
    coverImageUrl: "",
    logoUrl: "",
    status: "draft",
  };
}

function fromMosque(m: Mosque): FormState {
  return {
    name: { en: m.name.en, ar: m.name.ar ?? "", tr: m.name.tr ?? "", id: m.name.id ?? "" },
    legalName: m.legalName ?? "",
    denomination: m.denomination,
    description: {
      en: m.description?.en ?? "",
      ar: m.description?.ar ?? "",
      tr: m.description?.tr ?? "",
      id: m.description?.id ?? "",
    },
    address: { line1: m.address.line1, line2: m.address.line2 ?? "", postalCode: m.address.postalCode ?? "" },
    city: m.city,
    region: m.region ?? "",
    country: m.country,
    location: m.location,
    timezone: m.timezone,
    contact: { phone: m.contact?.phone ?? "", email: m.contact?.email ?? "", website: m.contact?.website ?? "" },
    social: {
      facebook: m.social?.facebook ?? "",
      instagram: m.social?.instagram ?? "",
      youtube: m.social?.youtube ?? "",
      whatsapp: m.social?.whatsapp ?? "",
    },
    capacity: m.capacity,
    services: { ...emptyServices(), ...m.services },
    languages: m.languages ?? [],
    altSpellings: m.altSpellings ?? [],
    prayerCalc: m.prayerCalc ?? defaultPrayerCalc(),
    iqamah: m.iqamah ?? {},
    coverImageUrl: m.coverImage?.url ?? "",
    logoUrl: m.logoUrl ?? "",
    status: m.status,
  };
}

export function MosqueForm({ mode, initial }: MosqueFormProps) {
  const router = useRouter();
  const t = useTranslations("mosquesAdmin.form");
  const tValidation = useTranslations("mosquesAdmin.form.validation");
  const tActions = useTranslations("mosquesAdmin.form.actions");
  const tToast = useTranslations("mosquesAdmin.actions");
  const tCommon = useTranslations("common");
  const tServices = useTranslations("mosques.services");
  const tDenominations = useTranslations("mosques.denominations");
  const tPrayer = useTranslations("mosques.prayer");

  const [state, setState] = useState<FormState>(initial ? fromMosque(initial) : emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, startTransition] = useTransition();
  const [geocodeBusy, setGeocodeBusy] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!state.name.en || state.name.en.trim().length < 2) next.nameEn = tValidation("nameRequired");
    if (!state.address.line1.trim()) next.addressLine1 = tValidation("addressRequired");
    if (!state.city.trim()) next.city = tValidation("cityRequired");
    if (!/^[A-Za-z]{2}$/.test(state.country.trim())) next.country = tValidation("countryRequired");
    if (!Number.isFinite(state.location.lat) || !Number.isFinite(state.location.lng)) {
      next.coords = tValidation("coordsRequired");
    } else if (
      state.location.lat < -90 ||
      state.location.lat > 90 ||
      state.location.lng < -180 ||
      state.location.lng > 180
    ) {
      next.coords = tValidation("coordsRange");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const input: MosqueInput = {
      ...state,
      country: state.country.toUpperCase(),
      languages: state.languages.filter(Boolean),
      altSpellings: state.altSpellings?.filter(Boolean),
    };
    startTransition(async () => {
      const res = mode === "create"
        ? await createMosque(input)
        : await updateMosque(initial!.slug, input);
      if (!res.ok) {
        toast.error(res.error ?? tToast("errorGeneric"));
        return;
      }
      toast.success(
        mode === "create"
          ? tToast("createdToast", { name: state.name.en })
          : tToast("updatedToast", { name: state.name.en }),
      );
      router.push("/admin/mosques");
      router.refresh();
    });
  }

  async function geocodeAddress() {
    const parts = [state.address.line1, state.city, state.region, state.country].filter(Boolean).join(", ");
    if (!parts) return;
    setGeocodeBusy(true);
    try {
      const res = await fetch(`/api/admin/geocode?q=${encodeURIComponent(parts)}`);
      if (!res.ok) {
        toast.error(t("geocodeNoResult"));
        return;
      }
      const data = (await res.json()) as { lat?: number; lng?: number; timezone?: string };
      if (typeof data.lat !== "number" || typeof data.lng !== "number") {
        toast.error(t("geocodeNoResult"));
        return;
      }
      setState((s) => ({
        ...s,
        location: { lat: data.lat!, lng: data.lng! },
        timezone: data.timezone ?? s.timezone,
      }));
    } finally {
      setGeocodeBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Identity */}
      <Section title={t("sectionIdentity")}>
        <Field label={t("nameEn")} error={errors.nameEn}>
          <Input
            value={state.name.en}
            onChange={(e) => setState((s) => ({ ...s, name: { ...s.name, en: e.target.value } }))}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("nameAr")}>
            <Input
              dir="rtl"
              lang="ar"
              className="font-arabic"
              value={state.name.ar ?? ""}
              onChange={(e) => setState((s) => ({ ...s, name: { ...s.name, ar: e.target.value } }))}
            />
          </Field>
          <Field label={t("nameTr")}>
            <Input
              value={state.name.tr ?? ""}
              onChange={(e) => setState((s) => ({ ...s, name: { ...s.name, tr: e.target.value } }))}
            />
          </Field>
          <Field label={t("nameId")}>
            <Input
              value={state.name.id ?? ""}
              onChange={(e) => setState((s) => ({ ...s, name: { ...s.name, id: e.target.value } }))}
            />
          </Field>
        </div>
        <Field label={t("legalName")}>
          <Input
            value={state.legalName ?? ""}
            onChange={(e) => setState((s) => ({ ...s, legalName: e.target.value }))}
          />
        </Field>
        <Field label={t("denomination")}>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={state.denomination}
            onChange={(e) => setState((s) => ({ ...s, denomination: e.target.value as MosqueInput["denomination"] }))}
          >
            {DENOMINATIONS.map((d) => (
              <option key={d} value={d}>
                {tDenominations(d)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("descriptionEn")}>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={state.description?.en ?? ""}
            onChange={(e) => setState((s) => ({ ...s, description: { ...(s.description ?? { en: "" }), en: e.target.value } }))}
          />
        </Field>
        <Field label={t("descriptionAr")}>
          <textarea
            dir="rtl"
            lang="ar"
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-arabic"
            value={state.description?.ar ?? ""}
            onChange={(e) => setState((s) => ({ ...s, description: { ...(s.description ?? { en: "" }), ar: e.target.value } }))}
          />
        </Field>
      </Section>

      {/* Location */}
      <Section title={t("sectionLocation")}>
        <Field label={t("addressLine1")} error={errors.addressLine1}>
          <Input
            value={state.address.line1}
            onChange={(e) => setState((s) => ({ ...s, address: { ...s.address, line1: e.target.value } }))}
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("addressLine2")}>
            <Input
              value={state.address.line2 ?? ""}
              onChange={(e) => setState((s) => ({ ...s, address: { ...s.address, line2: e.target.value } }))}
            />
          </Field>
          <Field label={t("postalCode")}>
            <Input
              value={state.address.postalCode ?? ""}
              onChange={(e) => setState((s) => ({ ...s, address: { ...s.address, postalCode: e.target.value } }))}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("city")} error={errors.city}>
            <Input
              value={state.city}
              onChange={(e) => setState((s) => ({ ...s, city: e.target.value }))}
            />
          </Field>
          <Field label={t("region")}>
            <Input
              value={state.region ?? ""}
              onChange={(e) => setState((s) => ({ ...s, region: e.target.value }))}
            />
          </Field>
          <Field label={t("country")} error={errors.country}>
            <Input
              maxLength={2}
              className="uppercase"
              value={state.country}
              onChange={(e) => setState((s) => ({ ...s, country: e.target.value.toUpperCase() }))}
              placeholder="AZ"
            />
          </Field>
        </div>
        <div className="flex items-end gap-3">
          <Button type="button" variant="secondary" onClick={geocodeAddress} disabled={geocodeBusy}>
            {geocodeBusy ? <Loader2 className="animate-spin" /> : <MapPin />}
            {geocodeBusy ? t("geocodeWorking") : t("geocode")}
          </Button>
          {errors.coords && <p className="text-xs text-danger">{errors.coords}</p>}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("lat")}>
            <Input
              type="number"
              step="0.000001"
              value={Number.isFinite(state.location.lat) ? state.location.lat : ""}
              onChange={(e) => setState((s) => ({ ...s, location: { ...s.location, lat: parseFloat(e.target.value) } }))}
            />
          </Field>
          <Field label={t("lng")}>
            <Input
              type="number"
              step="0.000001"
              value={Number.isFinite(state.location.lng) ? state.location.lng : ""}
              onChange={(e) => setState((s) => ({ ...s, location: { ...s.location, lng: parseFloat(e.target.value) } }))}
            />
          </Field>
          <Field label={t("timezone")}>
            <Input
              placeholder="Europe/Istanbul"
              value={state.timezone}
              onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))}
            />
          </Field>
        </div>
      </Section>

      {/* Contact */}
      <Section title={t("sectionContact")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("phone")}>
            <Input
              value={state.contact?.phone ?? ""}
              onChange={(e) => setState((s) => ({ ...s, contact: { ...s.contact, phone: e.target.value } }))}
            />
          </Field>
          <Field label={t("email")}>
            <Input
              type="email"
              value={state.contact?.email ?? ""}
              onChange={(e) => setState((s) => ({ ...s, contact: { ...s.contact, email: e.target.value } }))}
            />
          </Field>
          <Field label={t("website")}>
            <Input
              type="url"
              value={state.contact?.website ?? ""}
              onChange={(e) => setState((s) => ({ ...s, contact: { ...s.contact, website: e.target.value } }))}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("facebook")}>
            <Input
              type="url"
              value={state.social?.facebook ?? ""}
              onChange={(e) => setState((s) => ({ ...s, social: { ...s.social, facebook: e.target.value } }))}
            />
          </Field>
          <Field label={t("instagram")}>
            <Input
              type="url"
              value={state.social?.instagram ?? ""}
              onChange={(e) => setState((s) => ({ ...s, social: { ...s.social, instagram: e.target.value } }))}
            />
          </Field>
          <Field label={t("youtube")}>
            <Input
              type="url"
              value={state.social?.youtube ?? ""}
              onChange={(e) => setState((s) => ({ ...s, social: { ...s.social, youtube: e.target.value } }))}
            />
          </Field>
          <Field label={t("whatsapp")}>
            <Input
              value={state.social?.whatsapp ?? ""}
              onChange={(e) => setState((s) => ({ ...s, social: { ...s.social, whatsapp: e.target.value } }))}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("languages")}>
            <Input
              placeholder="en, ar, tr"
              value={state.languages.join(", ")}
              onChange={(e) => setState((s) => ({ ...s, languages: e.target.value.split(",").map((v) => v.trim()) }))}
            />
          </Field>
          <Field label={t("altSpellings")}>
            <Input
              value={(state.altSpellings ?? []).join(", ")}
              onChange={(e) =>
                setState((s) => ({ ...s, altSpellings: e.target.value.split(",").map((v) => v.trim()) }))
              }
            />
          </Field>
          <Field label={t("capacity")}>
            <Input
              type="number"
              min={0}
              value={state.capacity ?? ""}
              onChange={(e) =>
                setState((s) => ({ ...s, capacity: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) }))
              }
            />
          </Field>
        </div>
      </Section>

      {/* Services */}
      <Section title={t("sectionServices")}>
        <div className="grid gap-2 md:grid-cols-3">
          {SERVICE_KEYS.map((k) => (
            <label key={k} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(state.services?.[k])}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    services: { ...emptyServices(), ...(s.services as Partial<MosqueServices>), [k]: e.target.checked },
                  }))
                }
              />
              {tServices(k)}
            </label>
          ))}
        </div>
      </Section>

      {/* Prayer */}
      <Section title={t("sectionPrayer")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("calcMethod")}>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.prayerCalc?.method ?? "MWL"}
              onChange={(e) =>
                setState((s) => ({ ...s, prayerCalc: { ...(s.prayerCalc ?? defaultPrayerCalc()), method: e.target.value as NonNullable<MosqueInput["prayerCalc"]>["method"] } }))
              }
            >
              {(["MWL", "ISNA", "EGYPT", "MAKKAH", "KARACHI", "TEHRAN", "JAFARI"] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("asrMethod")}>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.prayerCalc?.asrMethod ?? "shafi"}
              onChange={(e) =>
                setState((s) => ({ ...s, prayerCalc: { ...(s.prayerCalc ?? defaultPrayerCalc()), asrMethod: e.target.value as "shafi" | "hanafi" } }))
              }
            >
              <option value="shafi">Shafi / Maliki / Hanbali</option>
              <option value="hanafi">Hanafi</option>
            </select>
          </Field>
          <Field label={t("highLatRule")}>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.prayerCalc?.highLatitudeRule ?? "MIDDLE_OF_NIGHT"}
              onChange={(e) =>
                setState((s) => ({ ...s, prayerCalc: { ...(s.prayerCalc ?? defaultPrayerCalc()), highLatitudeRule: e.target.value as "MIDDLE_OF_NIGHT" | "ANGLE_BASED" | "ONE_SEVENTH" } }))
              }
            >
              <option value="MIDDLE_OF_NIGHT">Middle of night</option>
              <option value="ANGLE_BASED">Angle-based</option>
              <option value="ONE_SEVENTH">One seventh</option>
            </select>
          </Field>
        </div>
        <div className="space-y-3 mt-2">
          {PRAYER_KEYS.map((p) => (
            <IqamahRow
              key={p}
              prayerLabel={tPrayer(p)}
              modeLabels={{
                none: t("iqamahModeNone"),
                offset: t("iqamahModeOffset"),
                fixed: t("iqamahModeFixed"),
              }}
              fieldLabels={{
                offset: t("iqamahOffsetMinutes"),
                fixed: t("iqamahFixedTime"),
              }}
              value={state.iqamah?.[p]}
              onChange={(next) =>
                setState((s) => ({ ...s, iqamah: { ...(s.iqamah ?? {}), [p]: next } }))
              }
            />
          ))}
        </div>
      </Section>

      {/* Media */}
      <Section title={t("sectionMedia")}>
        <Field label={t("coverImageUrl")}>
          <Input
            type="url"
            value={state.coverImageUrl ?? ""}
            onChange={(e) => setState((s) => ({ ...s, coverImageUrl: e.target.value }))}
          />
        </Field>
        <Field label={t("logoUrl")}>
          <Input
            type="url"
            value={state.logoUrl ?? ""}
            onChange={(e) => setState((s) => ({ ...s, logoUrl: e.target.value }))}
          />
        </Field>
      </Section>

      {/* Status + actions */}
      <div className="flex flex-wrap items-end gap-3 border-t border-border pt-6">
        <Field label={t("status")} className="max-w-xs">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={state.status}
            onChange={(e) => setState((s) => ({ ...s, status: e.target.value as MosqueInput["status"] }))}
          >
            <option value="draft">Draft</option>
            <option value="pending_review">Pending review</option>
            <option value="published">Published</option>
            <option value="suspended">Suspended</option>
          </select>
        </Field>
        <div className="ms-auto flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Save />}
            {submitting ? tActions("saving") : mode === "create" ? tActions("create") : tActions("save")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function IqamahRow({
  prayerLabel,
  modeLabels,
  fieldLabels,
  value,
  onChange,
}: {
  prayerLabel: string;
  modeLabels: { none: string; offset: string; fixed: string };
  fieldLabels: { offset: string; fixed: string };
  value: IqamahRule | undefined;
  onChange: (next: IqamahRule | undefined) => void;
}) {
  const mode = value?.mode ?? "none";
  return (
    <div className="grid gap-3 md:grid-cols-[140px_180px_1fr] items-end border-b border-dashed border-border pb-3">
      <div className="text-sm font-medium text-foreground">{prayerLabel}</div>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={mode}
        onChange={(e) => {
          const next = e.target.value as "none" | "offset" | "fixed";
          if (next === "none") onChange(undefined);
          else if (next === "offset") onChange({ mode: "offset", minutesAfterAdhan: 15 });
          else onChange({ mode: "fixed", time: "13:30" });
        }}
      >
        <option value="none">{modeLabels.none}</option>
        <option value="offset">{modeLabels.offset}</option>
        <option value="fixed">{modeLabels.fixed}</option>
      </select>
      {mode === "offset" && value?.mode === "offset" && (
        <Input
          type="number"
          min={-30}
          max={120}
          value={value.minutesAfterAdhan}
          aria-label={fieldLabels.offset}
          onChange={(e) => onChange({ mode: "offset", minutesAfterAdhan: Number(e.target.value) })}
        />
      )}
      {mode === "fixed" && value?.mode === "fixed" && (
        <Input
          type="time"
          value={value.time}
          aria-label={fieldLabels.fixed}
          onChange={(e) => onChange({ mode: "fixed", time: e.target.value })}
        />
      )}
      {mode === "none" && <div />}
    </div>
  );
}
