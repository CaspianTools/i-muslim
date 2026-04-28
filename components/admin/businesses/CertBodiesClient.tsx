"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/common/CountryCombobox";
import { countryName } from "@/lib/mosques/countries";
import {
  EditorDialog,
  EditorDialogBody,
  EditorDialogContent,
  EditorDialogFooter,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { FormGrid } from "@/components/admin/ui/form-layout";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import {
  createCertBodyAction,
  updateCertBodyAction,
  deleteCertBodyAction,
} from "@/lib/admin/actions/business-taxonomies";
import type { BusinessCertificationBody } from "@/types/business";

interface Props {
  initialCertBodies: BusinessCertificationBody[];
  canPersist: boolean;
}

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

export function CertBodiesClient({ initialCertBodies, canPersist }: Props) {
  const t = useTranslations("businesses.admin");
  const tCommon = useTranslations("common");
  const [items, setItems] = useState(initialCertBodies);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessCertificationBody | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusinessCertificationBody | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setOpen(true);
  }
  function openEdit(c: BusinessCertificationBody) {
    setEditing(c);
    setForm({
      slug: c.slug,
      name: c.name,
      country: c.country,
      website: c.website ?? "",
      logoStoragePath: c.logoStoragePath ?? "",
      verifiedByPlatform: c.verifiedByPlatform,
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPersist) return toast.error(t("noPersistToast"));
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
      const result = editing
        ? await updateCertBodyAction(editing.id, payload)
        : await createCertBodyAction(payload);
      if (!result.ok) return toast.error(result.error);
      if (editing) {
        setItems((prev) => prev.map((x) => (x.id === editing.id ? { ...x, ...payload, id: editing.id } : x)));
        toast.success(t("taxonomyUpdatedToast"));
      } else {
        setItems((prev) => [...prev, { id: result.data.id, ...payload }]);
        toast.success(t("taxonomyCreatedToast"));
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!canPersist) {
      toast.error(t("noPersistToast"));
      return;
    }
    const r = await deleteCertBodyAction(target.id);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== target.id));
    toast.success(t("taxonomyDeletedToast"));
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} disabled={!canPersist}>
          <Plus className="size-4" /> {t("taxonomyAddCta")}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t("taxonomyEmpty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">{t("slug")}</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">{t("verifiedByPlatformLabel")}</th>
                <th className="px-3 py-2 text-end">{tCommon("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2.5 font-medium">{c.name}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{c.slug}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground me-1.5">{c.country}</span>
                    {countryName(c.country)}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.verifiedByPlatform ? <Badge variant="info">●</Badge> : <Badge>—</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditorDialog open={open} onOpenChange={setOpen}>
        <EditorDialogContent>
          <form onSubmit={submit} className="flex h-full flex-col">
            <EditorDialogHeader>
              <EditorDialogTitle>{editing ? t("taxonomyEditCta") : t("taxonomyAddCta")}</EditorDialogTitle>
            </EditorDialogHeader>
            <EditorDialogBody className="space-y-3">
              <FormGrid>
                <div className="space-y-1.5">
                  <Label>{t("slug")}</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                    disabled={Boolean(editing)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                    required
                  />
                </div>
              </FormGrid>
              <FormGrid cols={3}>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <CountryCombobox
                    required
                    value={form.country}
                    onChange={(code) => setForm((s) => ({ ...s, country: code }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input
                    value={form.website}
                    onChange={(e) => setForm((s) => ({ ...s, website: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("logoStoragePath")}</Label>
                  <Input
                    value={form.logoStoragePath}
                    onChange={(e) => setForm((s) => ({ ...s, logoStoragePath: e.target.value }))}
                  />
                </div>
              </FormGrid>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.verifiedByPlatform}
                  onChange={(e) => setForm((s) => ({ ...s, verifiedByPlatform: e.target.checked }))}
                />
                {t("verifiedByPlatformLabel")}
              </label>
            </EditorDialogBody>
            <EditorDialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={submitting || !canPersist}>
                {submitting ? t("saving") : editing ? t("save") : t("create")}
              </Button>
            </EditorDialogFooter>
          </form>
        </EditorDialogContent>
      </EditorDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("taxonomyDeleteTitle")}
        description={t("taxonomyDeleteDescription", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("taxonomyDeleteCta")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
