"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getApplicationUploadUrlAction,
  submitMosqueApplicationAction,
} from "@/app/[locale]/(site)/mosques/apply/actions";
import type { MosqueApplicationInput } from "@/lib/mosques/apply-schema";

export interface ClaimTarget {
  slug: string;
  name: string;
  alreadyManaged: boolean;
}

const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

type ProofDoc = MosqueApplicationInput["proofDoc"];

export function MosqueApplyForm({
  claimTarget,
  userEmail,
}: {
  claimTarget?: ClaimTarget;
  userEmail: string;
}) {
  const t = useTranslations("mosques.apply");
  const router = useRouter();
  const [kind, setKind] = useState<"claim" | "register">(claimTarget ? "claim" : "register");
  const [manualSlug, setManualSlug] = useState(claimTarget?.slug ?? "");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [proof, setProof] = useState<ProofDoc | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const locked = Boolean(claimTarget?.alreadyManaged);

  async function handleProofSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type)) {
      toast.error(t("proofTypeError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("proofSizeError"));
      return;
    }
    setUploading(true);
    try {
      const res = await getApplicationUploadUrlAction({
        kind,
        mosqueSlug: kind === "claim" ? claimTarget?.slug ?? manualSlug.trim() : undefined,
        filename: file.name,
        contentType: file.type,
        contentLength: file.size,
      });
      if (!res.ok || !res.result) {
        toast.error(t("uploadFailed"));
        return;
      }
      const put = await fetch(res.result.url, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!put.ok) {
        toast.error(t("uploadFailed"));
        return;
      }
      setProof({
        url: res.result.publicUrl,
        storagePath: res.result.storagePath,
        contentType: file.type,
        filename: file.name,
      });
      toast.success(t("proofUploaded"));
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!proof) {
      toast.error(t("proofRequired"));
      return;
    }
    let payload: MosqueApplicationInput;
    if (kind === "claim") {
      const slug = (claimTarget?.slug ?? manualSlug).trim();
      if (!slug) {
        toast.error(t("slugRequired"));
        return;
      }
      payload = { kind: "claim", mosqueSlug: slug, message: message.trim() || undefined, proofDoc: proof };
    } else {
      if (!name.trim() || !city.trim() || !/^[A-Za-z]{2}$/.test(country.trim())) {
        toast.error(t("registerFieldsRequired"));
        return;
      }
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      payload = {
        kind: "register",
        proposedMosque: {
          name: name.trim(),
          city: city.trim(),
          country: country.trim().toUpperCase(),
          address: address.trim() || undefined,
          // Admin refines the precise pin on approval (location is admin-locked).
          location: { lat: 0, lng: 0 },
          timezone,
        },
        message: message.trim() || undefined,
        proofDoc: proof,
      };
    }

    setSubmitting(true);
    try {
      const res = await submitMosqueApplicationAction(payload);
      if (!res.ok) {
        const key = `errors.${res.error}`;
        toast.error(t.has(key as never) ? t(key as never) : t("submitFailed"));
        return;
      }
      setDone(true);
    } catch {
      toast.error(t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">{t("successTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("successBody")}</p>
        <Button className="mt-4" onClick={() => router.push("/mosques")}>
          {t("backToDirectory")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode toggle */}
      {!claimTarget && (
        <div className="inline-flex rounded-lg border border-border p-1 text-sm">
          {(["claim", "register"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                "rounded-md px-3 py-1.5 " +
                (kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {t(k === "claim" ? "modeClaim" : "modeRegister")}
            </button>
          ))}
        </div>
      )}

      {locked && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          {t("alreadyManaged")}
        </div>
      )}

      {kind === "claim" ? (
        <div className="space-y-2">
          <Label>{t("claimMosque")}</Label>
          {claimTarget ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
              {claimTarget.name}
            </p>
          ) : (
            <>
              <Input
                value={manualSlug}
                onChange={(e) => setManualSlug(e.target.value)}
                placeholder={t("slugPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="m-name">{t("fieldName")}</Label>
            <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-city">{t("fieldCity")}</Label>
            <Input id="m-city" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-country">{t("fieldCountry")}</Label>
            <Input
              id="m-country"
              value={country}
              maxLength={2}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              placeholder="GB"
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="m-address">{t("fieldAddress")}</Label>
            <Input id="m-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">{t("registerLocationNote")}</p>
        </div>
      )}

      {/* Proof upload */}
      <div className="space-y-2">
        <Label>{t("proofLabel")}</Label>
        <div className="flex items-center gap-3">
          <label
            className={
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted " +
              (uploading ? "cursor-not-allowed opacity-50" : "")
            }
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {proof ? t("proofReplace") : t("proofUpload")}
            <input
              type="file"
              accept={PROOF_TYPES.join(",")}
              className="hidden"
              onChange={handleProofSelect}
              disabled={uploading}
            />
          </label>
          {proof && <span className="text-xs text-muted-foreground">{proof.filename}</span>}
        </div>
        <p className="text-xs text-muted-foreground">{t("proofHint")}</p>
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <Label htmlFor="m-message">{t("messageLabel")}</Label>
        <textarea
          id="m-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t("contactNote", { email: userEmail })}</p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || uploading || locked}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  );
}
