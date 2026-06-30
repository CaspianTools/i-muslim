"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Phone,
  Printer,
  QrCode,
  Rocket,
  Save,
  Settings2,
  Share2,
  User,
} from "lucide-react";
import { BUNDLED_LOCALES, LOCALE_META } from "@/i18n/config";
import { pickLocalized } from "@/lib/utils";
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
import { MosqueEventComposer } from "@/components/mosque/MosqueEventComposer";
import type { AsrMethod, CalcMethod, HighLatitudeRule, Mosque, MosqueSocial } from "@/types/mosque";
import {
  CALC_METHODS,
  ASR_METHODS,
  HIGH_LAT_RULES,
  defaultPrayerCalc,
  computeAdhan,
  formatTimeInZone,
} from "@/lib/mosques/adhan";
import {
  updateMosqueManage,
  updateMosqueLogo,
  updateMosqueCover,
  publishMosque,
  ensureMosqueShortCode,
} from "@/app/[locale]/(site)/mosques/manage-actions";

const DAILY = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

// Sidebar menu items (icon + label key). Order = sidebar order top→bottom.
const MANAGE_TABS = [
  { value: "profile", Icon: User, labelKey: "tabProfile" },
  { value: "media", Icon: ImageIcon, labelKey: "tabMedia" },
  { value: "prayer", Icon: Clock, labelKey: "tabPrayer" },
  { value: "contact", Icon: Phone, labelKey: "tabContact" },
  { value: "social", Icon: Share2, labelKey: "tabSocial" },
  { value: "events", Icon: CalendarDays, labelKey: "tabEvents" },
  { value: "share", Icon: QrCode, labelKey: "tabShare" },
] as const;

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
  const tCalc = useTranslations("mosques.prayerCalc");
  const router = useRouter();
  const uiLocale = useLocale();
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState("profile");
  const mosqueName = pickLocalized(mosque.name, uiLocale, "en") ?? mosque.name.en;
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
  const [prayerCalc, setPrayerCalc] = useState(mosque.prayerCalc ?? defaultPrayerCalc());
  const [social, setSocial] = useState<MosqueSocial>(mosque.social ?? {});

  // Live adhan preview for today, recomputed as the calc-method selection
  // changes, so the manager can verify the times before saving. Needs a real
  // location (admin-set, geocoded on approval); falls back to a hint otherwise.
  const [today] = useState(() => new Date());
  const hasLocation =
    Number.isFinite(mosque.location?.lat) &&
    Number.isFinite(mosque.location?.lng) &&
    !(mosque.location.lat === 0 && mosque.location.lng === 0);
  const adhan = useMemo(() => {
    if (!hasLocation) return null;
    const c = computeAdhan({ location: mosque.location, prayerCalc }, today);
    const tz = mosque.timezone || "UTC";
    return {
      fajr: formatTimeInZone(c.fajr, tz, uiLocale),
      dhuhr: formatTimeInZone(c.dhuhr, tz, uiLocale),
      asr: formatTimeInZone(c.asr, tz, uiLocale),
      maghrib: formatTimeInZone(c.maghrib, tz, uiLocale),
      isha: formatTimeInZone(c.isha, tz, uiLocale),
    } as Record<(typeof DAILY)[number], string>;
  }, [hasLocation, mosque.location, mosque.timezone, prayerCalc, today, uiLocale]);

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

  // Single "Save" for the whole panel — commits every editable field section at
  // once. Logo/cover persist on upload; Events/Share are separate flows.
  function saveAll() {
    void run("all", () =>
      updateMosqueManage(mosque.slug, {
        about,
        contact,
        social,
        prayerCalc,
        iqamah: {
          fajr: iqamah.fajr,
          dhuhr: iqamah.dhuhr,
          asr: iqamah.asr,
          maghrib: iqamah.maghrib,
          isha: iqamah.isha,
          jumuah: iqamah.jumuah ? [iqamah.jumuah] : [],
        },
      }),
    );
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

      <DialogContent className="flex max-w-4xl flex-col gap-0 p-0 sm:h-[min(82vh,720px)] sm:max-h-[82vh]">
        <DialogHeader className="shrink-0 ps-6 pe-12 pt-6 pb-4">
          <DialogTitle className="font-display text-lg">{t("title")}</DialogTitle>
        </DialogHeader>

        {isDraft && (
          <div className="shrink-0 px-6 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="text-sm text-foreground">{t("publishHint")}</p>
              <Button onClick={handlePublish} disabled={saving === "publish"} size="sm">
                {saving === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {t("publish")}
              </Button>
            </div>
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={setTab}
          orientation="vertical"
          className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row"
        >
          <TabsList className="flex h-auto w-full shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-border/50 bg-transparent p-2 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-e sm:p-3">
            {MANAGE_TABS.map(({ value, Icon, labelKey }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="shrink-0 justify-start gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm sm:w-full data-[state=active]:bg-selected data-[state=active]:text-selected-foreground"
              >
                <Icon className="size-4 shrink-0" />
                {t(labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-w-0 flex-1 overflow-y-auto p-6 max-h-[60vh] sm:max-h-none">
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
              <Label>{tCalc("heading")}</Label>
              <p className="text-xs text-muted-foreground">{tCalc("hint")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{tCalc("calcMethod")}</span>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={prayerCalc.method}
                    onChange={(e) =>
                      setPrayerCalc((s) => ({ ...s, method: e.target.value as CalcMethod }))
                    }
                  >
                    {CALC_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {tCalc(`methods.${m}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{tCalc("asrMethod")}</span>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={prayerCalc.asrMethod}
                    onChange={(e) =>
                      setPrayerCalc((s) => ({ ...s, asrMethod: e.target.value as AsrMethod }))
                    }
                  >
                    {ASR_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {tCalc(`asrMethods.${m}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{tCalc("highLatRule")}</span>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={prayerCalc.highLatitudeRule}
                    onChange={(e) =>
                      setPrayerCalc((s) => ({
                        ...s,
                        highLatitudeRule: e.target.value as HighLatitudeRule,
                      }))
                    }
                  >
                    {HIGH_LAT_RULES.map((r) => (
                      <option key={r} value={r}>
                        {tCalc(`highLatRules.${r}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-5">
                <Label>{t("iqamah")}</Label>
                <p className="text-xs text-muted-foreground">{t("iqamahHint")}</p>
                {/* Each row pairs the computed adhan time (from the method above)
                    with the editable iqamah time, so the selection is verifiable. */}
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-[5rem_4.5rem_1fr] items-center gap-3 text-xs text-muted-foreground">
                    <span></span>
                    <span>{tCalc("adhanLabel")}</span>
                    <span>{tCalc("iqamahLabel")}</span>
                  </div>
                  {DAILY.map((p) => (
                    <div key={p} className="grid grid-cols-[5rem_4.5rem_1fr] items-center gap-3">
                      <span className="text-sm font-medium">{tPrayer(p)}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {adhan ? adhan[p] : "—"}
                      </span>
                      <Input
                        type="time"
                        className="max-w-[10rem]"
                        value={iqamah[p]}
                        onChange={(e) => setIqamah((s) => ({ ...s, [p]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-[5rem_4.5rem_1fr] items-center gap-3">
                    <span className="text-sm font-medium">{tPrayer("jumuah")}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">—</span>
                    <Input
                      type="time"
                      className="max-w-[10rem]"
                      value={iqamah.jumuah}
                      onChange={(e) => setIqamah((s) => ({ ...s, jumuah: e.target.value }))}
                    />
                  </div>
                  {!hasLocation && (
                    <p className="pt-1 text-xs text-muted-foreground">{tCalc("previewNoLocation")}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Contact */}
            <TabsContent value="contact" className="space-y-2">
              <Label>{t("contact")}</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input placeholder={t("phone")} value={contact.phone} onChange={(e) => setContact((s) => ({ ...s, phone: e.target.value }))} />
                <Input placeholder={t("email")} value={contact.email} onChange={(e) => setContact((s) => ({ ...s, email: e.target.value }))} />
                <Input placeholder={t("website")} value={contact.website} onChange={(e) => setContact((s) => ({ ...s, website: e.target.value }))} />
              </div>
            </TabsContent>

            {/* Social */}
            <TabsContent value="social">
              <SocialLinksEditor value={social} onChange={setSocial} />
            </TabsContent>

            {/* Events — embedded submit form. Manager-only (Manage is gated to
                managers); the public "Add event" CTA was removed. */}
            <TabsContent value="events">
              <MosqueEventComposer
                slug={mosque.slug}
                mosqueName={mosqueName}
                active={tab === "events"}
                onDone={() => onOpenChange?.(false)}
              />
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

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/50 px-6 py-3">
          <Button variant="primary" size="sm" onClick={saveAll} disabled={saving === "all"}>
            {saving === "all" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t("save")}
          </Button>
        </div>
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

