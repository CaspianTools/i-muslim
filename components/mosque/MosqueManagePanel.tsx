"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Copy,
  Download,
  FileText,
  ImagePlus,
  ImageUp,
  Loader2,
  QrCode,
  Rocket,
  Save,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Mosque } from "@/types/mosque";
import {
  updateMosqueAbout,
  updateMosqueContact,
  updateMosqueSocial,
  updateMosqueIqamah,
  updateMosqueLogo,
  updateMosqueCover,
  updateMosqueGallery,
  getManageUploadUrlAction,
  finalizeMosqueUploadAction,
  publishMosque,
} from "@/app/[locale]/(site)/mosques/manage-actions";

const DAILY = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export function MosqueManagePanel({
  mosque,
  analytics,
}: {
  mosque: Mosque;
  analytics?: { views: number; scans: number };
}) {
  const t = useTranslations("mosques.manage");
  const tPrayer = useTranslations("mosques.prayer");
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  const [about, setAbout] = useState(mosque.about ?? "");
  const [contact, setContact] = useState({
    phone: mosque.contact?.phone ?? "",
    email: mosque.contact?.email ?? "",
    website: mosque.contact?.website ?? "",
  });
  const [social, setSocial] = useState({
    facebook: mosque.social?.facebook ?? "",
    instagram: mosque.social?.instagram ?? "",
    youtube: mosque.social?.youtube ?? "",
    whatsapp: mosque.social?.whatsapp ?? "",
  });
  const [iqamah, setIqamah] = useState({
    fajr: mosque.iqamah?.fajr ?? "",
    dhuhr: mosque.iqamah?.dhuhr ?? "",
    asr: mosque.iqamah?.asr ?? "",
    maghrib: mosque.iqamah?.maghrib ?? "",
    isha: mosque.iqamah?.isha ?? "",
    jumuah: mosque.iqamah?.jumuah?.[0] ?? "",
  });
  const [gallery, setGallery] = useState<Array<{ url: string; storagePath: string }>>(
    (mosque.gallery ?? [])
      .map((g) => ({ url: g.url, storagePath: g.storagePath ?? "" }))
      .filter((g) => g.storagePath),
  );

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setSaving(key);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(t("saveFailed"));
        return false;
      }
      toast.success(t("saved"));
      router.refresh();
      return true;
    } finally {
      setSaving(null);
    }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSaving("logo");
    try {
      const up = await getManageUploadUrlAction({
        slug: mosque.slug,
        kind: "logo",
        filename: file.name,
        contentType: file.type,
        contentLength: file.size,
      });
      if (!up.ok || !up.url || !up.storagePath) return toast.error(t("saveFailed"));
      const put = await fetch(up.url, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) return toast.error(t("saveFailed"));
      const fin = await finalizeMosqueUploadAction(mosque.slug, up.storagePath);
      if (!fin.ok || !fin.url) return toast.error(t("saveFailed"));
      const res = await updateMosqueLogo(mosque.slug, { url: fin.url, storagePath: up.storagePath });
      if (!res.ok) return toast.error(t("saveFailed"));
      toast.success(t("saved"));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function uploadImage(
    kind: "cover" | "gallery",
    file: File,
  ): Promise<{ url: string; storagePath: string } | null> {
    const up = await getManageUploadUrlAction({
      slug: mosque.slug,
      kind,
      filename: file.name,
      contentType: file.type,
      contentLength: file.size,
    });
    if (!up.ok || !up.url || !up.storagePath) return null;
    const put = await fetch(up.url, { method: "PUT", headers: { "content-type": file.type }, body: file });
    if (!put.ok) return null;
    const fin = await finalizeMosqueUploadAction(mosque.slug, up.storagePath);
    if (!fin.ok || !fin.url) return null;
    return { url: fin.url, storagePath: up.storagePath };
  }

  async function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSaving("cover");
    try {
      const img = await uploadImage("cover", file);
      if (!img) return toast.error(t("saveFailed"));
      const res = await updateMosqueCover(mosque.slug, img);
      if (!res.ok) return toast.error(t("saveFailed"));
      toast.success(t("saved"));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function handleGalleryAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSaving("gallery");
    try {
      const img = await uploadImage("gallery", file);
      if (!img) return toast.error(t("saveFailed"));
      const next = [...gallery, img].slice(0, 12);
      const res = await updateMosqueGallery(mosque.slug, next);
      if (!res.ok) return toast.error(t("saveFailed"));
      setGallery(next);
      toast.success(t("saved"));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function handleGalleryRemove(idx: number) {
    const next = gallery.filter((_, i) => i !== idx);
    setSaving("gallery");
    try {
      const res = await updateMosqueGallery(mosque.slug, next);
      if (!res.ok) return toast.error(t("saveFailed"));
      setGallery(next);
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function handlePublish() {
    setSaving("publish");
    try {
      const res = await publishMosque(mosque.slug);
      if (!res.ok) {
        if (res.error === "incomplete" && res.missing) {
          toast.error(t("publishIncomplete", { fields: res.missing.join(", ") }));
        } else {
          toast.error(t("saveFailed"));
        }
        return;
      }
      toast.success(t("published"));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function copyLink() {
    if (!mosque.shortCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/m/${mosque.shortCode}`);
      toast.success(t("copied"));
    } catch {
      toast.error(t("saveFailed"));
    }
  }

  const isDraft = mosque.status !== "published";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Settings2 className="size-4" /> {t("manage")}
          {isDraft && (
            <span className="ms-1 rounded bg-warning/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-foreground">
              {t("draftBadge")}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{t("title")}</DialogTitle>
        </DialogHeader>

        {isDraft && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-sm text-foreground">{t("publishHint")}</p>
            <Button onClick={handlePublish} disabled={saving === "publish"} size="sm">
              {saving === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {t("publish")}
            </Button>
          </div>
        )}

        <Tabs defaultValue="profile">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="profile">{t("tabProfile")}</TabsTrigger>
            <TabsTrigger value="media">{t("tabMedia")}</TabsTrigger>
            <TabsTrigger value="prayer">{t("tabPrayer")}</TabsTrigger>
            <TabsTrigger value="contact">{t("tabContact")}</TabsTrigger>
            <TabsTrigger value="share">{t("tabShare")}</TabsTrigger>
          </TabsList>

          <div className="mt-4 max-h-[60vh] overflow-y-auto pe-1">
            {/* Profile */}
            <TabsContent value="profile" className="space-y-2">
              <Label htmlFor="mng-about">{t("about")}</Label>
              <textarea
                id="mng-about"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                rows={6}
                maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder={t("aboutPlaceholder")}
              />
              <SaveButton
                label={t("save")}
                busy={saving === "about"}
                onClick={() => run("about", () => updateMosqueAbout(mosque.slug, about))}
              />
            </TabsContent>

            {/* Media */}
            <TabsContent value="media" className="space-y-6">
              <div className="space-y-2">
                <Label>{t("logo")}</Label>
                <div className="flex items-center gap-3">
                  {mosque.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mosque.logoUrl} alt="" className="size-12 rounded-md border border-border object-cover" />
                  )}
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                    {saving === "logo" ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
                    {mosque.logoUrl ? t("replaceLogo") : t("uploadLogo")}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogo} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("cover")}</Label>
                <div className="flex items-center gap-3">
                  {mosque.coverImage?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mosque.coverImage.url} alt="" className="h-16 w-28 rounded-md border border-border object-cover" />
                  )}
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                    {saving === "cover" ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
                    {mosque.coverImage?.url ? t("replaceCover") : t("uploadCover")}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCover} />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("gallery")}</Label>
                <div className="flex flex-wrap gap-2">
                  {gallery.map((g, idx) => (
                    <div key={g.storagePath} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.url} alt="" className="size-20 rounded-md border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => handleGalleryRemove(idx)}
                        disabled={saving === "gallery"}
                        className="absolute end-0.5 top-0.5 inline-flex size-5 items-center justify-center rounded bg-background/90 text-danger"
                        aria-label={t("removePhoto")}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                  {gallery.length < 12 && (
                    <label className="inline-flex size-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-input bg-background hover:bg-muted">
                      {saving === "gallery" ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-5 text-muted-foreground" />}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleGalleryAdd} />
                    </label>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Prayer / Iqamah */}
            <TabsContent value="prayer" className="space-y-2">
              <Label>{t("iqamah")}</Label>
              <p className="text-xs text-muted-foreground">{t("iqamahHint")}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {DAILY.map((p) => (
                  <div key={p} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{tPrayer(p)}</span>
                    <Input
                      type="time"
                      value={iqamah[p]}
                      onChange={(e) => setIqamah((s) => ({ ...s, [p]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{tPrayer("jumuah")}</span>
                  <Input
                    type="time"
                    value={iqamah.jumuah}
                    onChange={(e) => setIqamah((s) => ({ ...s, jumuah: e.target.value }))}
                  />
                </div>
              </div>
              <SaveButton
                label={t("save")}
                busy={saving === "iqamah"}
                onClick={() =>
                  run("iqamah", () =>
                    updateMosqueIqamah(mosque.slug, {
                      fajr: iqamah.fajr,
                      dhuhr: iqamah.dhuhr,
                      asr: iqamah.asr,
                      maghrib: iqamah.maghrib,
                      isha: iqamah.isha,
                      jumuah: iqamah.jumuah ? [iqamah.jumuah] : [],
                    }),
                  )
                }
              />
            </TabsContent>

            {/* Contact + Social */}
            <TabsContent value="contact" className="space-y-6">
              <div className="space-y-2">
                <Label>{t("contact")}</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input placeholder={t("phone")} value={contact.phone} onChange={(e) => setContact((s) => ({ ...s, phone: e.target.value }))} />
                  <Input placeholder={t("email")} value={contact.email} onChange={(e) => setContact((s) => ({ ...s, email: e.target.value }))} />
                  <Input placeholder={t("website")} value={contact.website} onChange={(e) => setContact((s) => ({ ...s, website: e.target.value }))} />
                </div>
                <SaveButton label={t("save")} busy={saving === "contact"} onClick={() => run("contact", () => updateMosqueContact(mosque.slug, contact))} />
              </div>
              <div className="space-y-2">
                <Label>{t("social")}</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder={t("facebook")} value={social.facebook} onChange={(e) => setSocial((s) => ({ ...s, facebook: e.target.value }))} />
                  <Input placeholder={t("instagram")} value={social.instagram} onChange={(e) => setSocial((s) => ({ ...s, instagram: e.target.value }))} />
                  <Input placeholder={t("youtube")} value={social.youtube} onChange={(e) => setSocial((s) => ({ ...s, youtube: e.target.value }))} />
                  <Input placeholder={t("whatsapp")} value={social.whatsapp} onChange={(e) => setSocial((s) => ({ ...s, whatsapp: e.target.value }))} />
                </div>
                <SaveButton label={t("save")} busy={saving === "social"} onClick={() => run("social", () => updateMosqueSocial(mosque.slug, social))} />
              </div>
            </TabsContent>

            {/* Share + analytics */}
            <TabsContent value="share" className="space-y-6">
              {analytics && (
                <div className="grid grid-cols-3 gap-3">
                  <Stat label={t("statViews")} value={analytics.views} />
                  <Stat label={t("statScans")} value={analytics.scans} />
                  <Stat label={t("statFollowers")} value={mosque.followerCount ?? 0} />
                </div>
              )}
              {mosque.shortCode ? (
                <div className="space-y-2">
                  <Label className="inline-flex items-center gap-1.5">
                    <QrCode className="size-4" /> {t("shareTitle")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("shareHint")}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                      i-muslim.com/m/{mosque.shortCode}
                    </code>
                    <Button variant="secondary" size="sm" onClick={copyLink} type="button">
                      <Copy className="size-4" /> {t("copyLink")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/m/${mosque.shortCode}/poster`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                      <FileText className="size-4" /> {t("downloadPoster")}
                    </a>
                    <a href={`/m/${mosque.shortCode}/qr?format=png`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                      <Download className="size-4" /> {t("downloadPng")}
                    </a>
                    <a href={`/m/${mosque.shortCode}/qr?format=svg`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                      <Download className="size-4" /> {t("downloadSvg")}
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("shareUnavailable")}</p>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <div className="text-xl font-semibold tabular-nums text-foreground">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SaveButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
      {label}
    </Button>
  );
}
