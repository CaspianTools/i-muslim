"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { toast } from "@/components/ui/sonner";
import { slugify } from "@/lib/blog/slug";
import {
  createCertBodyAction,
  updateCertBodyAction,
} from "@/lib/admin/actions/business-taxonomies";
import type { BusinessCertificationBody } from "@/types/business";

interface FormState {
  slug: string;
  name: string;
  country: string;
  website: string;
  logoStoragePath: string;
  verifiedByPlatform: boolean;
}

const blankForm = (): FormState => ({
  slug: "",
  name: "",
  country: "GB",
  website: "",
  logoStoragePath: "",
  verifiedByPlatform: false,
});

interface Props {
  certBody: BusinessCertificationBody | null;
  canPersist: boolean;
  onSaved: (saved: BusinessCertificationBody) => void;
  onCancel: () => void;
}

export function CertBodyForm({ certBody, canPersist, onSaved, onCancel }: Props) {
  const t = useTranslations("businesses.admin");
  const tCommon = useTranslations("common");
  const isEdit = Boolean(certBody);
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [form, setForm] = useState<FormState>(() =>
    certBody
      ? {
          slug: certBody.slug,
          name: certBody.name,
          country: certBody.country,
          website: certBody.website ?? "",
          logoStoragePath: certBody.logoStoragePath ?? "",
          verifiedByPlatform: certBody.verifiedByPlatform,
        }
      : blankForm(),
  );

  function handleNameChange(value: string) {
    setForm((s) => ({
      ...s,
      name: value,
      slug: slugTouched ? s.slug : slugify(value),
    }));
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setForm((s) => ({ ...s, slug: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        country: form.country.trim().toUpperCase(),
        website: form.website.trim() || undefined,
        logoStoragePath: form.logoStoragePath.trim() || undefined,
        verifiedByPlatform: form.verifiedByPlatform,
      };
      const result = certBody
        ? await updateCertBodyAction(certBody.id, payload)
        : await createCertBodyAction(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(certBody ? t("taxonomyUpdatedToast") : t("taxonomyCreatedToast"));
      onSaved({
        id: result.data.id,
        slug: payload.slug,
        name: payload.name,
        country: payload.country,
        website: payload.website,
        logoStoragePath: payload.logoStoragePath,
        verifiedByPlatform: payload.verifiedByPlatform,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="space-y-4 md:border-e md:border-border md:pe-5">
            <div>
              <Label htmlFor="cb-slug">{t("slug")}</Label>
              <Input
                id="cb-slug"
                className="mt-1"
                value={form.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                disabled={isEdit}
                required
              />
            </div>
            <div>
              <Label htmlFor="cb-country">{t("country")}</Label>
              <div className="mt-1">
                <CountryCombobox
                  required
                  id="cb-country"
                  value={form.country}
                  onChange={(code) => setForm((s) => ({ ...s, country: code }))}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.verifiedByPlatform}
                onChange={(e) =>
                  setForm((s) => ({ ...s, verifiedByPlatform: e.target.checked }))
                }
              />
              {t("verifiedByPlatformLabel")}
            </label>
          </aside>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cb-name">{t("name")}</Label>
              <Input
                id="cb-name"
                className="mt-1"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="cb-website">{t("website")}</Label>
              <Input
                id="cb-website"
                className="mt-1"
                type="url"
                value={form.website}
                onChange={(e) => setForm((s) => ({ ...s, website: e.target.value }))}
                placeholder="https://"
              />
            </div>
            <div>
              <Label htmlFor="cb-logo">{t("logoStoragePath")}</Label>
              <Input
                id="cb-logo"
                className="mt-1"
                value={form.logoStoragePath}
                onChange={(e) =>
                  setForm((s) => ({ ...s, logoStoragePath: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border bg-background px-5 py-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          <X /> {tCommon("cancel")}
        </Button>
        <Button type="submit" disabled={submitting || !canPersist}>
          <Save /> {submitting ? t("saving") : isEdit ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
