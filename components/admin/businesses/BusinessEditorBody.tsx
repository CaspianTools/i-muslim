"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import {
  EditorDialogBody,
  EditorDialogDescription,
  EditorDialogFooter,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { Field, FormGrid, Section } from "@/components/admin/ui/form-layout";
import { toast } from "@/components/ui/sonner";
import {
  createBusinessAction,
  updateBusinessAction,
} from "@/lib/admin/actions/businesses";
import type { BusinessInput } from "@/lib/businesses/schemas";
import { businessInputSchema } from "@/lib/businesses/schemas";
import type {
  Business,
  BusinessAmenity,
  BusinessCategory,
  BusinessCertificationBody,
  BusinessHours,
  BusinessPhoto,
  BusinessStatus,
  HalalStatus,
  PriceTier,
} from "@/types/business";
import { HoursEditor } from "./HoursEditor";
import { PhotoUploader } from "./PhotoUploader";

interface Props {
  business?: Business | null;
  categories: BusinessCategory[];
  amenities: BusinessAmenity[];
  certBodies: BusinessCertificationBody[];
  canPersist: boolean;
  onSaved: (saved: Business, mode: "create" | "update") => void;
  onCancel: () => void;
  /** Optional left-aligned header element (e.g. Quick Create back button). */
  headerLeading?: React.ReactNode;
}

const STATUSES: BusinessStatus[] = ["draft", "published", "archived"];
const HALAL: HalalStatus[] = ["certified", "self_declared", "muslim_owned", "unverified"];
const PRICES: (PriceTier | "any")[] = ["any", 1, 2, 3, 4];

const EMPTY_HOURS: BusinessHours = {
  mon: { open: "09:00", close: "18:00" },
  tue: { open: "09:00", close: "18:00" },
  wed: { open: "09:00", close: "18:00" },
  thu: { open: "09:00", close: "18:00" },
  fri: { open: "09:00", close: "18:00" },
  sat: { open: "10:00", close: "16:00" },
  sun: null,
};

interface FormState {
  status: BusinessStatus;
  name: string;
  descEn: string;
  descAr: string;
  descTr: string;
  descId: string;
  categoryIds: string[];
  amenityIds: string[];
  halalStatus: HalalStatus;
  certBodyId: string;
  certNumber: string;
  certExpiresAt: string;
  muslimOwned: boolean;
  platformVerified: boolean;
  line1: string;
  city: string;
  region: string;
  countryCode: string;
  postalCode: string;
  lat: string;
  lng: string;
  hours: BusinessHours;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  whatsapp: string;
  ownerEmail: string;
  priceTier: PriceTier | "any";
  photos: BusinessPhoto[];
}

function defaults(b?: Business | null): FormState {
  return {
    status: b?.status ?? "draft",
    name: b?.name ?? "",
    descEn: b?.description.en ?? "",
    descAr: b?.description.ar ?? "",
    descTr: b?.description.tr ?? "",
    descId: b?.description.id ?? "",
    categoryIds: b?.categoryIds ?? [],
    amenityIds: b?.amenityIds ?? [],
    halalStatus: b?.halal.status ?? "unverified",
    certBodyId: b?.halal.certificationBodyId ?? "",
    certNumber: b?.halal.certificationNumber ?? "",
    certExpiresAt: b?.halal.expiresAt ? b.halal.expiresAt.slice(0, 10) : "",
    muslimOwned: b?.muslimOwned ?? false,
    platformVerified: Boolean(b?.platformVerifiedAt),
    line1: b?.address.line1 ?? "",
    city: b?.address.city ?? "London",
    region: b?.address.region ?? "England",
    countryCode: b?.address.countryCode ?? "GB",
    postalCode: b?.address.postalCode ?? "",
    lat: b?.address.lat != null ? String(b.address.lat) : "",
    lng: b?.address.lng != null ? String(b.address.lng) : "",
    hours: b?.hours ?? EMPTY_HOURS,
    phone: b?.contact.phone ?? "",
    email: b?.contact.email ?? "",
    website: b?.contact.website ?? "",
    instagram: b?.contact.instagram ?? "",
    whatsapp: b?.contact.whatsapp ?? "",
    ownerEmail: b?.ownerEmail ?? "",
    priceTier: b?.priceTier ?? "any",
    photos: b?.photos ?? [],
  };
}

export function BusinessEditorBody({
  business,
  categories,
  amenities,
  certBodies,
  canPersist,
  onSaved,
  onCancel,
  headerLeading,
}: Props) {
  const t = useTranslations("businesses.admin");
  const tCommon = useTranslations("common");
  const tHalal = useTranslations("businesses.halalStatuses");
  const tStatus = useTranslations("businesses.statuses");
  const tPrice = useTranslations("businesses.priceTiers");
  const editing = Boolean(business);

  const [form, setForm] = useState<FormState>(defaults(business));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(defaults(business));
    setError(null);
  }, [business]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function toggleArrayMember(key: "categoryIds" | "amenityIds", id: string) {
    setForm((s) => {
      const set = new Set(s[key]);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...s, [key]: Array.from(set) };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    setError(null);

    const input: BusinessInput = {
      status: form.status,
      name: form.name.trim(),
      description: {
        en: form.descEn.trim(),
        ar: form.descAr.trim() || undefined,
        tr: form.descTr.trim() || undefined,
        id: form.descId.trim() || undefined,
      },
      categoryIds: form.categoryIds,
      amenityIds: form.amenityIds,
      halal: {
        status: form.halalStatus,
        certificationBodyId: form.halalStatus === "certified" ? form.certBodyId || undefined : undefined,
        certificationNumber: form.certNumber.trim() || undefined,
        expiresAt: form.certExpiresAt ? new Date(form.certExpiresAt).toISOString() : undefined,
      },
      muslimOwned: form.muslimOwned,
      platformVerifiedAt: form.platformVerified
        ? business?.platformVerifiedAt ?? new Date().toISOString()
        : undefined,
      contact: {
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
      },
      address: {
        line1: form.line1.trim(),
        city: form.city.trim(),
        region: form.region.trim() || undefined,
        countryCode: form.countryCode.trim().toUpperCase(),
        postalCode: form.postalCode.trim() || undefined,
        lat: Number(form.lat),
        lng: Number(form.lng),
      },
      hours: { ...form.hours, notes: form.hours.notes },
      priceTier: form.priceTier === "any" ? undefined : form.priceTier,
      photos: form.photos.map((p) => ({
        storagePath: p.storagePath,
        alt: p.alt,
        width: p.width,
        height: p.height,
      })),
      ownerEmail: form.ownerEmail.trim() || undefined,
    };

    const parsed = businessInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    try {
      const result = editing && business
        ? await updateBusinessAction(business.id, parsed.data)
        : await createBusinessAction(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        setError(result.error);
        return;
      }
      onSaved(result.data, editing ? "update" : "create");
      toast.success(
        editing ? t("updatedToast", { name: result.data.name }) : t("createdToast", { name: result.data.name }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <EditorDialogHeader>
        {headerLeading}
        <EditorDialogTitle>{editing ? t("editTitle") : t("createTitle")}</EditorDialogTitle>
        <EditorDialogDescription>
          {editing ? t("editDescription") : t("createDescription")}
        </EditorDialogDescription>
      </EditorDialogHeader>
      <EditorDialogBody className="space-y-5">
        <Section title={t("sectionBasics")}>
          <FormGrid cols={3}>
            <Field label={t("name")} required>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="off" />
            </Field>
            <Field label={t("filterByStatus")}>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.status}
                onChange={(e) => update("status", e.target.value as BusinessStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{tStatus(s)}</option>
                ))}
              </select>
            </Field>
            <Field label={t("priceTier")}>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={String(form.priceTier)}
                onChange={(e) => {
                  const v = e.target.value;
                  update("priceTier", v === "any" ? "any" : (Number(v) as PriceTier));
                }}
              >
                {PRICES.map((p) => (
                  <option key={p} value={String(p)}>{p === "any" ? tPrice("any") : tPrice(String(p))}</option>
                ))}
              </select>
            </Field>
          </FormGrid>

          <Field label={t("categoriesLabel")} required>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleArrayMember("categoryIds", c.id)}
                  className={
                    "rounded-full border px-2.5 py-1 text-xs " +
                    (form.categoryIds.includes(c.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted")
                  }
                >
                  {c.name.en}
                </button>
              ))}
            </div>
          </Field>

          <FormGrid>
            <Field label={t("descEnLabel")} required>
              <Textarea value={form.descEn} onChange={(v) => update("descEn", v)} />
            </Field>
            <Field label={t("descArLabel")}>
              <Textarea value={form.descAr} onChange={(v) => update("descAr", v)} dir="rtl" lang="ar" />
            </Field>
            <Field label={t("descTrLabel")}>
              <Textarea value={form.descTr} onChange={(v) => update("descTr", v)} lang="tr" />
            </Field>
            <Field label={t("descIdLabel")}>
              <Textarea value={form.descId} onChange={(v) => update("descId", v)} lang="id" />
            </Field>
          </FormGrid>
        </Section>

        <Section title={t("sectionTrust")}>
          <FormGrid>
            <Field label={t("halalStatusLabel")}>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.halalStatus}
                onChange={(e) => update("halalStatus", e.target.value as HalalStatus)}
              >
                {HALAL.map((s) => (
                  <option key={s} value={s}>{tHalal(s)}</option>
                ))}
              </select>
            </Field>
          </FormGrid>

          {form.halalStatus === "certified" && (
            <FormGrid cols={3}>
              <Field label={t("certBodyLabel")} required>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.certBodyId}
                  onChange={(e) => update("certBodyId", e.target.value)}
                >
                  <option value="">—</option>
                  {certBodies.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("certNumberLabel")}>
                <Input value={form.certNumber} onChange={(e) => update("certNumber", e.target.value)} />
              </Field>
              <Field label={t("certExpiresLabel")}>
                <Input
                  type="date"
                  value={form.certExpiresAt}
                  onChange={(e) => update("certExpiresAt", e.target.value)}
                />
              </Field>
            </FormGrid>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.muslimOwned}
                onChange={(e) => update("muslimOwned", e.target.checked)}
              />
              {t("muslimOwnedLabel")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.platformVerified}
                onChange={(e) => update("platformVerified", e.target.checked)}
              />
              <span>
                {t("platformVerifiedLabel")}
                <span className="block text-xs text-muted-foreground">{t("platformVerifiedHint")}</span>
              </span>
            </label>
          </div>
        </Section>

        <Section title={t("sectionLocation")}>
          <FormGrid>
            <Field label={t("addressLine1")} required>
              <Input value={form.line1} onChange={(e) => update("line1", e.target.value)} />
            </Field>
            <Field label={t("country")}>
              <CountryCombobox
                value={form.countryCode}
                onChange={(code) => update("countryCode", code)}
              />
            </Field>
          </FormGrid>
          <FormGrid cols={3}>
            <Field label={t("city")} required>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </Field>
            <Field label={t("region")}>
              <Input value={form.region} onChange={(e) => update("region", e.target.value)} />
            </Field>
            <Field label={t("postalCode")}>
              <Input value={form.postalCode} onChange={(e) => update("postalCode", e.target.value)} />
            </Field>
          </FormGrid>
          <FormGrid>
            <Field label={t("lat")} required>
              <Input
                type="number"
                step="0.000001"
                value={form.lat}
                onChange={(e) => update("lat", e.target.value)}
              />
            </Field>
            <Field label={t("lng")} required>
              <Input
                type="number"
                step="0.000001"
                value={form.lng}
                onChange={(e) => update("lng", e.target.value)}
              />
            </Field>
          </FormGrid>
        </Section>

        <Section title={t("sectionHours")}>
          <HoursEditor value={form.hours} onChange={(h) => update("hours", h)} />
        </Section>

        <Section title={t("sectionContact")}>
          <FormGrid cols={3}>
            <Field label={t("phone")}>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </Field>
            <Field label={t("email")}>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label={t("website")}>
              <Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" />
            </Field>
            <Field label={t("instagram")}>
              <Input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} placeholder="@handle" />
            </Field>
            <Field label={t("whatsapp")}>
              <Input value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
            </Field>
            <Field label={t("ownerEmail")}>
              <Input
                type="email"
                value={form.ownerEmail}
                onChange={(e) => update("ownerEmail", e.target.value)}
              />
            </Field>
          </FormGrid>
        </Section>

        <Section title={t("sectionAmenities")}>
          <div className="flex flex-wrap gap-1.5">
            {amenities.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => toggleArrayMember("amenityIds", a.id)}
                className={
                  "rounded-full border px-2.5 py-1 text-xs " +
                  (form.amenityIds.includes(a.id)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted")
                }
              >
                {a.name.en}
              </button>
            ))}
          </div>
        </Section>

        {business && (
          <Section title={t("sectionPhotos")}>
            <PhotoUploader
              businessId={business.id}
              value={form.photos}
              onChange={(p) => update("photos", p)}
              disabled={!canPersist}
            />
          </Section>
        )}

        {!canPersist && <p className="text-xs text-warning">{t("noPersistNote")}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
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
          {submitting ? t("saving") : <><Save /> {editing ? t("save") : t("create")}</>}
        </Button>
      </EditorDialogFooter>
    </form>
  );
}

function Textarea({
  value,
  onChange,
  dir,
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  dir?: "rtl" | "ltr";
  lang?: string;
}) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir={dir}
      lang={lang}
      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    />
  );
}
