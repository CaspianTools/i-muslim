"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Loader2,
  Printer,
  QrCode,
  Rocket,
  Save,
  Settings2,
} from "lucide-react";
import { BUNDLED_LOCALES, LOCALE_META } from "@/i18n/config";
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
import { ImageDropzone } from "@/components/mosque/community/ImageDropzone";
import { SocialLinksEditor } from "@/components/mosque/community/SocialLinksEditor";
import type { Mosque } from "@/types/mosque";
import {
  updateMosqueAbout,
  updateMosqueContact,
  updateMosqueIqamah,
  updateMosqueLogo,
  updateMosqueCover,
  publishMosque,
  ensureMosqueShortCode,
} from "@/app/[locale]/(site)/mosques/manage-actions";

const DAILY = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export function MosqueManagePanel({
  mosque,
  analytics,
  open,
  onOpenChange,
}: {
  mosque: Mosque;
  analytics?: { views: number; scans: number };
  /** When provided, the dialog is controlled (e.g. opened from the kebab menu)
   *  and renders no trigger button of its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("mosques.manage");
  const tPrayer = useTranslations("mosques.prayer");
  const router = useRouter();
  const uiLocale = useLocale();
  const [saving, setSaving] = useState<string | null>(null);
  // Poster print language — defaults to the manager's UI language when it's one
  // of the bundled (fully translated) locales, else English.
  const [posterLang, setPosterLang] = useState<string>(
    (BUNDLED_LOCALES as readonly string[]).includes(uiLocale) ? uiLocale : "en",
  );

  const [about, setAbout] = useState(mosque.about ?? "");
  const [contact, setContact] = useState({
    phone: mosque.contact?.phone ?? "",
    email: mosque.contact?.email ?? "",
    website: mosque.contact?.website ?? "",
  });
  const [iqamah, setIqamah] = useState({
    fajr: mosque.iqamah?.fajr ?? "",
    dhuhr: mosque.iqamah?.dhuhr ?? "",
    asr: mosque.iqamah?.asr ?? "",
    maghrib: mosque.iqamah?.maghrib ?? "",
    isha: mosque.iqamah?.isha ?? "",
    jumuah: mosque.iqamah?.jumuah?.[0] ?? "",
  });

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setSaving(key);
    try {
      const res = await fn();
      if (!res.ok) {
        toast.error(t("saveFailed"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    } finally {
      setSaving(null);
    }
  }

  async function saveLogo(img: { url: string; storagePath: string }) {
    const res = await updateMosqueLogo(mosque.slug, img);
    if (res.ok) {
      toast.success(t("saved"));
      router.refresh();
    } else toast.error(t("saveFailed"));
  }

  async function saveCover(img: { url: string; storagePath: string }) {
    const res = await updateMosqueCover(mosque.slug, img);
    if (res.ok) {
      toast.success(t("saved"));
      router.refresh();
    } else toast.error(t("saveFailed"));
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

  async function createShareLink() {
    setSaving("shortcode");
    try {
      const res = await ensureMosqueShortCode(mosque.slug);
      if (res.ok) {
        toast.success(t("saved"));
        router.refresh();
      } else {
        toast.error(t("saveFailed"));
      }
    } finally {
      setSaving(null);
    }
  }

  const isDraft = mosque.status !== "published";
  const controlled = open !== undefined;

  return (
    <Dialog open={controlled ? open : undefined} onOpenChange={onOpenChange}>
      {!controlled && (
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
      )}

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
            <TabsTrigger value="social">{t("tabSocial")}</TabsTrigger>
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

            {/* Media — logo + cover dropzones */}
            <TabsContent value="media" className="space-y-6">
              <div className="space-y-2">
                <Label>{t("logo")}</Label>
                <ImageDropzone
                  slug={mosque.slug}
                  kind="logo"
                  currentUrl={mosque.logoUrl}
                  onUploaded={saveLogo}
                  previewClassName="size-20 rounded-xl border border-border object-cover"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("cover")}</Label>
                <ImageDropzone
                  slug={mosque.slug}
                  kind="cover"
                  currentUrl={mosque.coverImage?.url}
                  onUploaded={saveCover}
                  previewClassName="h-24 w-full rounded-lg border border-border object-cover"
                />
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

            {/* Contact */}
            <TabsContent value="contact" className="space-y-2">
              <Label>{t("contact")}</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input placeholder={t("phone")} value={contact.phone} onChange={(e) => setContact((s) => ({ ...s, phone: e.target.value }))} />
                <Input placeholder={t("email")} value={contact.email} onChange={(e) => setContact((s) => ({ ...s, email: e.target.value }))} />
                <Input placeholder={t("website")} value={contact.website} onChange={(e) => setContact((s) => ({ ...s, website: e.target.value }))} />
              </div>
              <SaveButton label={t("save")} busy={saving === "contact"} onClick={() => run("contact", () => updateMosqueContact(mosque.slug, contact))} />
            </TabsContent>

            {/* Social */}
            <TabsContent value="social">
              <SocialLinksEditor slug={mosque.slug} initial={mosque.social} />
            </TabsContent>

            {/* Share + analytics */}
            <TabsContent value="share" className="space-y-6">
              {analytics && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-3">
                    <Stat label={t("statViews")} value={analytics.views} />
                    <Stat label={t("statScans")} value={analytics.scans} />
                    <Stat label={t("statFollowers")} value={mosque.followerCount ?? 0} />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">{t("statsLifetime")}</p>
                </div>
              )}
              {mosque.shortCode ? (
                <div className="space-y-3">
                  <Label className="inline-flex items-center gap-1.5">
                    <QrCode className="size-4" /> {t("shareTitle")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("shareHint")}</p>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {/* Live QR preview the manager can see before printing. */}
                    <div className="shrink-0 self-center rounded-lg border border-border bg-white p-2 sm:self-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/m/${mosque.shortCode}/qr?format=svg`}
                        alt={t("qrPreviewAlt")}
                        width={132}
                        height={132}
                        className="size-[132px]"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                          i-muslim.com/m/{mosque.shortCode}
                        </code>
                        <Button variant="secondary" size="sm" onClick={copyLink} type="button">
                          <Copy className="size-4" /> {t("copyLink")}
                        </Button>
                      </div>

                      {/* Printable poster — pick the language, then view / print it. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          {t("posterLanguage")}
                          <select
                            value={posterLang}
                            onChange={(e) => setPosterLang(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                          >
                            {BUNDLED_LOCALES.map((l) => (
                              <option key={l} value={l}>
                                {LOCALE_META[l].nativeName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <a
                          href={`/m/${mosque.shortCode}/poster?lang=${posterLang}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted"
                        >
                          <Printer className="size-4" /> {t("viewPoster")}
                        </a>
                      </div>

                      {/* Raw QR image downloads (logos, flyers, slides). */}
                      <div className="flex flex-wrap gap-2">
                        <a href={`/m/${mosque.shortCode}/qr?format=png`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                          <Download className="size-4" /> {t("downloadPng")}
                        </a>
                        <a href={`/m/${mosque.shortCode}/qr?format=svg`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted">
                          <Download className="size-4" /> {t("downloadSvg")}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("shareUnavailable")}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={saving === "shortcode"}
                    onClick={createShareLink}
                  >
                    {saving === "shortcode" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <QrCode className="size-4" />
                    )}
                    {t("createShareLink")}
                  </Button>
                </div>
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
