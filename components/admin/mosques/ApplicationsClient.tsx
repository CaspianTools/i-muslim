"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  approveMosqueApplication,
  rejectMosqueApplication,
  getApplicationProofUrlAction,
} from "@/app/[locale]/(admin)/admin/mosques/application-actions";
import type { MosqueApplication } from "@/types/mosque-application";

export function ApplicationsClient({ applications }: { applications: MosqueApplication[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function viewProof(storagePath: string) {
    const res = await getApplicationProofUrlAction(storagePath);
    if (!res.ok || !res.url) {
      toast.error("Couldn't open the proof document.");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function approve(app: MosqueApplication) {
    setBusyId(app.id);
    try {
      const res = await approveMosqueApplication(app.id);
      if (!res.ok) {
        toast.error(res.error ?? "Approval failed.");
        return;
      }
      toast.success(`Approved — manager assigned to ${res.slug}.`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function reject(app: MosqueApplication) {
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    setBusyId(app.id);
    try {
      const res = await rejectMosqueApplication(app.id, reason);
      if (!res.ok) {
        toast.error(res.error ?? "Rejection failed.");
        return;
      }
      toast.success("Application rejected.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (applications.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No pending masjid applications.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {applications.map((app) => {
        const target =
          app.kind === "claim" ? app.mosqueSlug : app.proposedMosque?.name;
        const busy = busyId === app.id;
        return (
          <li key={app.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={app.kind === "claim" ? "neutral" : "success"}>
                    {app.kind === "claim" ? "Claim" : "Register"}
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <Building2 className="size-4" /> {target}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {app.applicant.name ? `${app.applicant.name} · ` : ""}
                  {app.applicant.email}
                </p>
                {app.kind === "register" && app.proposedMosque && (
                  <p className="text-xs text-muted-foreground">
                    {app.proposedMosque.city}, {app.proposedMosque.country}
                    {app.proposedMosque.address ? ` · ${app.proposedMosque.address}` : ""}
                  </p>
                )}
                {app.message && (
                  <p className="mt-1 rounded-md bg-muted/40 p-2 text-sm text-foreground">
                    “{app.message}”
                  </p>
                )}
              </div>
              <div className="flex flex-col items-stretch gap-2">
                <Button
                  variant="secondary"
                  onClick={() => viewProof(app.proofDoc.storagePath)}
                  disabled={busy}
                >
                  <FileText className="size-4" /> Proof
                  <ExternalLink className="size-3.5" />
                </Button>
                <div className="flex gap-2">
                  <Button onClick={() => approve(app)} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Approve
                  </Button>
                  <Button variant="danger" onClick={() => reject(app)} disabled={busy}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
