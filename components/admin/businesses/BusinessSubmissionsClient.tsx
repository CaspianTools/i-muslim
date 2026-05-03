"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check, ExternalLink, Mail, MapPin, Store, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import {
  promoteBusinessSubmissionAction,
  rejectBusinessSubmissionAction,
} from "@/lib/admin/actions/business-submissions";
import { pickLocalized } from "@/lib/utils";
import type {
  BusinessSubmission,
  BusinessSubmissionStatus,
} from "@/lib/admin/data/businesses";
import type { BusinessCategory } from "@/types/business";
import type { Locale } from "@/i18n/config";

interface Props {
  initialSubmissions: BusinessSubmission[];
  categories: BusinessCategory[];
  canPersist: boolean;
}

const TABS: BusinessSubmissionStatus[] = ["pending_review", "approved", "rejected"];

export function BusinessSubmissionsClient({ initialSubmissions, categories, canPersist }: Props) {
  const t = useTranslations("businesses.admin.submissions");
  const tHalal = useTranslations("businesses.halalStatuses");
  const tAdmin = useTranslations("businesses.admin");
  const locale = useLocale() as Locale;

  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [tab, setTab] = useState<BusinessSubmissionStatus>("pending_review");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BusinessSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const categoryById = useMemo(() => {
    const map = new Map<string, BusinessCategory>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const grouped = useMemo(() => {
    const buckets: Record<BusinessSubmissionStatus, BusinessSubmission[]> = {
      pending_review: [],
      approved: [],
      rejected: [],
    };
    for (const s of submissions) buckets[s.status].push(s);
    return buckets;
  }, [submissions]);

  async function handlePromote(s: BusinessSubmission) {
    if (!canPersist) {
      toast.error(tAdmin("noPersistToast"));
      return;
    }
    setBusyId(s.id);
    try {
      const result = await promoteBusinessSubmissionAction(s.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSubmissions((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...x, status: "approved", promotedBusinessId: result.data.businessId }
            : x,
        ),
      );
      toast.success(t("promoteSuccess"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    if (!canPersist) {
      toast.error(tAdmin("noPersistToast"));
      setRejectTarget(null);
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      const result = await rejectBusinessSubmissionAction(rejectTarget.id, rejectReason.trim());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const targetId = rejectTarget.id;
      const reasonText = rejectReason.trim();
      setSubmissions((prev) =>
        prev.map((x) =>
          x.id === targetId
            ? { ...x, status: "rejected", rejectionReason: reasonText || undefined }
            : x,
        ),
      );
      toast.success(t("rejectSuccess"));
      setRejectTarget(null);
      setRejectReason("");
    } finally {
      setBusyId(null);
    }
  }

  function renderSubmission(s: BusinessSubmission) {
    const categoryNames = s.payload.categoryIds
      .map((id) => {
        const c = categoryById.get(id);
        return c ? pickLocalized(c.name, locale, "en") ?? c.name.en : id;
      });
    return (
      <li key={s.id} className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{s.payload.name}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {s.payload.addressLine1}, {s.payload.city}
              {s.payload.region ? `, ${s.payload.region}` : ""} ({s.payload.countryCode})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="info">{tHalal(s.payload.halalStatus)}</Badge>
            {categoryNames.map((n) => (
              <Badge key={n} variant="neutral">{n}</Badge>
            ))}
            {s.payload.muslimOwned && <Badge variant="success">{t("muslimOwnedBadge")}</Badge>}
            {s.payload.isOwner && <Badge variant="warning">{t("ownerBadge")}</Badge>}
          </div>
        </div>

        <p className="mt-3 whitespace-pre-line text-sm text-foreground/90">
          {s.payload.descriptionEn}
        </p>

        <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {s.payload.phone && (
            <div><dt className="inline text-muted-foreground">{t("fieldPhone")}: </dt><dd className="inline">{s.payload.phone}</dd></div>
          )}
          {s.payload.email && (
            <div><dt className="inline text-muted-foreground">{t("fieldEmail")}: </dt><dd className="inline">{s.payload.email}</dd></div>
          )}
          {s.payload.website && (
            <div className="sm:col-span-2">
              <dt className="inline text-muted-foreground">{t("fieldWebsite")}: </dt>
              <dd className="inline">
                <a href={s.payload.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {s.payload.website}
                </a>
              </dd>
            </div>
          )}
          {s.payload.instagram && (
            <div><dt className="inline text-muted-foreground">{t("fieldInstagram")}: </dt><dd className="inline">{s.payload.instagram}</dd></div>
          )}
          {s.payload.whatsapp && (
            <div><dt className="inline text-muted-foreground">{t("fieldWhatsapp")}: </dt><dd className="inline">{s.payload.whatsapp}</dd></div>
          )}
          {s.payload.certificationBodyName && s.payload.halalStatus === "certified" && (
            <div className="sm:col-span-2">
              <dt className="inline text-muted-foreground">{t("fieldCertBody")}: </dt>
              <dd className="inline">{s.payload.certificationBodyName}</dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Mail className="size-3" /> {s.submittedBy?.email ?? t("anonymous")}
            </span>
            <span>{new Date(s.createdAt).toLocaleString(locale)}</span>
            {s.status === "rejected" && s.rejectionReason && (
              <span className="text-danger">{t("rejectedFor", { reason: s.rejectionReason })}</span>
            )}
            {s.status === "approved" && s.promotedBusinessId && (
              <Link
                href="/admin/businesses"
                className="inline-flex items-center gap-1 underline hover:text-foreground"
              >
                <Store className="size-3" /> {t("viewPromoted")}
              </Link>
            )}
          </div>
          {s.status === "pending_review" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                onClick={() => handlePromote(s)}
                disabled={busyId === s.id || !canPersist}
              >
                <Check className="size-4" /> {t("approve")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRejectTarget(s);
                  setRejectReason("");
                }}
                disabled={busyId === s.id || !canPersist}
              >
                <X className="size-4" /> {t("reject")}
              </Button>
            </div>
          )}
          {s.status === "approved" && s.promotedBusinessId && (
            <Link
              href="/admin/businesses"
              className="inline-flex items-center gap-1 text-xs underline hover:text-foreground"
            >
              <ExternalLink className="size-3" /> {t("viewPromoted")}
            </Link>
          )}
        </div>
      </li>
    );
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as BusinessSubmissionStatus)}>
        <TabsList>
          <TabsTrigger value="pending_review">
            {t("tabPending")} ({grouped.pending_review.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            {t("tabApproved")} ({grouped.approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            {t("tabRejected")} ({grouped.rejected.length})
          </TabsTrigger>
        </TabsList>
        {TABS.map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            {grouped[s].length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("noSubmissions")}
              </p>
            ) : (
              <ul className="space-y-3">{grouped[s].map(renderSubmission)}</ul>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rejectDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("rejectDialogDescription", { name: rejectTarget?.payload.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t("rejectReasonLabel")}</Label>
            <textarea
              id="reject-reason"
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectTarget(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={busyId !== null}
              aria-busy={busyId !== null}
            >
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
