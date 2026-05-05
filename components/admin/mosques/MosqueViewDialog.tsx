"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Edit, ExternalLink, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  EditorDialog,
  EditorDialogBody,
  EditorDialogContent,
  EditorDialogDescription,
  EditorDialogFooter,
  EditorDialogHeader,
  EditorDialogTitle,
} from "@/components/ui/editor-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatRelative } from "@/lib/utils";
import { countryName } from "@/lib/mosques/countries";
import type { Mosque, MosqueServices, MosqueSubmission } from "@/types/mosque";
import {
  promoteSubmission,
  rejectSubmission,
} from "@/app/[locale]/(admin)/admin/mosques/actions";

export type MosqueViewSource =
  | { kind: "mosque"; data: Mosque }
  | { kind: "submission"; data: MosqueSubmission };

interface ViewModel {
  name: Mosque["name"];
  denomination: Mosque["denomination"];
  address: Mosque["address"];
  city: string;
  region?: string;
  country: string;
  location: { lat: number; lng: number };
  hasRealLocation: boolean;
  contact?: Mosque["contact"];
  description?: Mosque["description"];
  languages: string[];
  services: MosqueServices;
}

function toViewModel(source: MosqueViewSource): ViewModel {
  const data = source.kind === "mosque" ? source.data : source.data.payload;
  const location = data.location ?? { lat: 0, lng: 0 };
  return {
    name: data.name,
    denomination: data.denomination,
    address: data.address,
    city: data.city,
    region: data.region,
    country: data.country,
    location,
    hasRealLocation:
      source.kind === "mosque" && (location.lat !== 0 || location.lng !== 0),
    contact: data.contact,
    description: data.description,
    languages: data.languages ?? [],
    services: data.services,
  };
}

export function MosqueViewDialog({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: MosqueViewSource | null;
}) {
  const router = useRouter();
  const t = useTranslations("mosquesAdmin.viewDialog");
  const tToast = useTranslations("mosquesAdmin.actions");
  const tCommon = useTranslations("common");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setRejecting(false);
      setRejectReason("");
    }
    onOpenChange(next);
  }

  if (!source) return null;
  const view = toViewModel(source);

  function callAction(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onOk: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(`${tToast("errorGeneric")} (${res.error ?? "unknown"})`);
        return;
      }
      onOk();
      router.refresh();
      handleOpenChange(false);
    });
  }

  function handleApprove() {
    if (source?.kind !== "submission") return;
    const id = source.data.id;
    callAction(
      () => promoteSubmission(id),
      () => toast.success(tToast("promotedToast")),
    );
  }

  function handleReject() {
    if (source?.kind !== "submission") return;
    const id = source.data.id;
    callAction(
      () => rejectSubmission(id, rejectReason),
      () => toast.success(tToast("rejectedToast")),
    );
  }

  return (
    <EditorDialog open={open} onOpenChange={handleOpenChange}>
      <EditorDialogContent>
        <EditorDialogHeader>
          <div className="flex items-start gap-2">
            <EditorDialogTitle className="flex-1">{view.name.en}</EditorDialogTitle>
            <Badge variant={source.kind === "submission" ? "warning" : "neutral"}>
              {source.kind === "submission" ? t("badgeSubmission") : t("badgeMosque")}
            </Badge>
          </div>
          {view.name.ar && (
            <EditorDialogDescription
              dir="rtl"
              lang="ar"
              className="font-arabic text-base"
            >
              {view.name.ar}
            </EditorDialogDescription>
          )}
          {source.kind === "submission" && (
            <EditorDialogDescription>
              {t("submittedMeta", {
                who: source.data.submittedBy?.email
                  ?? source.data.submittedBy?.uid
                  ?? t("anonymous"),
                when: formatRelative(source.data.createdAt),
              })}
            </EditorDialogDescription>
          )}
        </EditorDialogHeader>

        <EditorDialogBody className="space-y-6">
          <Section label={t("sectionLocation")}>
            <Field label={t("address")}>
              {view.address.line1}
              {view.address.line2 && (
                <>
                  <br />
                  {view.address.line2}
                </>
              )}
            </Field>
            <Field label={t("city")}>
              {view.city}
              {view.region ? `, ${view.region}` : ""}
            </Field>
            <Field label={t("country")}>{countryName(view.country)}</Field>
            {view.hasRealLocation && (
              <Field label={t("coordinates")}>
                <span className="tabular-nums">
                  {view.location.lat.toFixed(5)}, {view.location.lng.toFixed(5)}
                </span>
              </Field>
            )}
          </Section>

          <Section label={t("sectionIdentity")}>
            <Field label={t("denomination")}>{t(`denominations.${view.denomination}`)}</Field>
            {view.languages.length > 0 && (
              <Field label={t("languages")}>{view.languages.join(", ")}</Field>
            )}
            {view.description?.en && (
              <Field label={t("description")}>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {view.description.en}
                </p>
              </Field>
            )}
          </Section>

          {view.contact && (view.contact.phone || view.contact.email || view.contact.website) && (
            <Section label={t("sectionContact")}>
              {view.contact.phone && (
                <Field label={t("phone")}>
                  <a className="text-primary hover:underline" href={`tel:${view.contact.phone}`}>
                    {view.contact.phone}
                  </a>
                </Field>
              )}
              {view.contact.email && (
                <Field label={t("email")}>
                  <a className="text-primary hover:underline" href={`mailto:${view.contact.email}`}>
                    {view.contact.email}
                  </a>
                </Field>
              )}
              {view.contact.website && (
                <Field label={t("website")}>
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={view.contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {view.contact.website}
                    <ExternalLink className="size-3" />
                  </a>
                </Field>
              )}
            </Section>
          )}

          <ServicesSection services={view.services} title={t("sectionServices")} emptyLabel={t("noServices")} />
        </EditorDialogBody>

        <EditorDialogFooter>
          {source.kind === "submission" ? (
            rejecting ? (
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="mosque-view-reject-reason">{t("rejectReasonLabel")}</Label>
                  <Input
                    id="mosque-view-reject-reason"
                    autoFocus
                    placeholder={t("rejectReasonPlaceholder")}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejecting(false);
                      setRejectReason("");
                    }}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={!rejectReason.trim()}
                    onClick={handleReject}
                  >
                    {t("rejectConfirm")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setRejecting(true)}>
                  <XCircle /> {t("reject")}
                </Button>
                <Button onClick={handleApprove}>
                  <CheckCircle2 /> {t("approve")}
                </Button>
              </>
            )
          ) : (
            <>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                {tCommon("close")}
              </Button>
              <Button asChild>
                <Link href={`/admin/mosques/${source.data.slug}/edit`}>
                  <Edit /> {t("edit")}
                </Link>
              </Button>
            </>
          )}
        </EditorDialogFooter>
      </EditorDialogContent>
    </EditorDialog>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr]">
      <div className="text-xs text-muted-foreground sm:pt-0.5">{label}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function ServicesSection({
  services,
  title,
  emptyLabel,
}: {
  services: MosqueServices;
  title: string;
  emptyLabel: string;
}) {
  const t = useTranslations("mosquesAdmin.viewDialog.services");
  const enabled = (Object.keys(services) as Array<keyof MosqueServices>).filter(
    (k) => services[k],
  );
  return (
    <Section label={title}>
      {enabled.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {enabled.map((k) => (
            <li key={k}>
              <Badge variant="neutral">{t(k)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
