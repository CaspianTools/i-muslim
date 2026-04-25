"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { toast } from "@/components/ui/sonner";
import { cn, formatRelative, initials } from "@/lib/utils";
import { ageFromDob } from "@/lib/matrimonial/age";
import {
  deleteProfile,
  setProfileStatus,
  setProfileVerification,
} from "@/app/[locale]/(admin)/admin/matrimonial/actions";
import type {
  MatrimonialProfile,
  ProfileStatus,
} from "@/types/matrimonial";

function statusVariant(s: ProfileStatus): "success" | "warning" | "danger" | "neutral" {
  if (s === "active") return "success";
  if (s === "pending") return "warning";
  if (s === "suspended") return "danger";
  return "neutral";
}

interface Props {
  profile: MatrimonialProfile | null;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updated: MatrimonialProfile) => void;
  onDelete: (id: string) => void;
}

export function ProfileDetailDrawer({ profile, onOpenChange, onUpdate, onDelete }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const t = useTranslations("matrimonial.admin");
  const tDrawer = useTranslations("matrimonial.admin.drawer");
  const tCommon = useTranslations("common");
  const tStatuses = useTranslations("matrimonial.statuses");
  const tGenders = useTranslations("matrimonial.genders");
  const tMadhhabs = useTranslations("matrimonial.madhhabs");
  const tPrayer = useTranslations("matrimonial.prayer");

  if (!profile) {
    return <Sheet open={false} onOpenChange={onOpenChange}><SheetContent /></Sheet>;
  }

  const age = ageFromDob(profile.dateOfBirth);

  function patchStatus(next: ProfileStatus) {
    if (!profile) return;
    const target = profile;
    startTransition(async () => {
      await setProfileStatus(target.id, next);
      const updated = { ...target, status: next };
      onUpdate(updated);
      toast.success(t(next === "active" ? "approved" : next === "suspended" ? "suspended" : "hidden", { name: target.displayName }));
    });
  }

  function patchVerification(key: keyof MatrimonialProfile["verification"], value: boolean) {
    if (!profile) return;
    const target = profile;
    startTransition(async () => {
      await setProfileVerification(target.id, { [key]: value });
      const updated = {
        ...target,
        verification: { ...target.verification, [key]: value },
      };
      onUpdate(updated);
    });
  }

  function handleDelete() {
    if (!profile) return;
    const target = profile;
    startTransition(async () => {
      await deleteProfile(target.id);
      onDelete(target.id);
      toast.success(t("deleted", { name: target.displayName }));
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={Boolean(profile)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>{tDrawer("title")}</SheetTitle>
          <SheetDescription>{profile.displayName}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1 text-base font-semibold text-foreground">
                {profile.displayName}
                {profile.verification.emailVerified && (
                  <BadgeCheck className="size-4 text-primary" />
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {age} · {profile.city}, {profile.country}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(profile.status)}>{tStatuses(profile.status)}</Badge>
            <Badge variant="neutral">{tGenders(profile.gender)}</Badge>
            <Badge variant="neutral">{tMadhhabs(profile.madhhab)}</Badge>
            <Badge variant="neutral">{tPrayer(profile.prayerCommitment)}</Badge>
          </div>

          <Tabs defaultValue="profile" className="mt-6">
            <TabsList>
              <TabsTrigger value="profile">{tDrawer("tabProfile")}</TabsTrigger>
              <TabsTrigger value="verification">{tDrawer("tabVerification")}</TabsTrigger>
              <TabsTrigger value="activity">{tDrawer("tabActivity")}</TabsTrigger>
              <TabsTrigger value="danger" className="text-danger">{tDrawer("tabDanger")}</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-3 pt-3 text-sm">
              <Row label="Email" value={profile.userId} mono />
              <Row label="Education" value={profile.education} />
              <Row label="Profession" value={profile.profession ?? "—"} />
              <Row label="Marital history" value={profile.maritalHistory.replace("_", " ")} />
              <Row label="Has children" value={profile.hasChildren ? tCommon("yes") : tCommon("no")} />
              <Row label="Wants children" value={profile.wantsChildren} />
              <Row label="Languages" value={profile.languages.join(", ") || "—"} />
              <Row label="Joined" value={formatRelative(profile.createdAt)} />
              <Row label="Last active" value={formatRelative(profile.lastActiveAt)} />
              <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                {profile.bio}
              </div>
            </TabsContent>

            <TabsContent value="verification" className="space-y-2 pt-3 text-sm">
              <p className="text-xs text-muted-foreground mb-3">{tDrawer("verificationNote")}</p>
              <VerifRow
                label={tDrawer("phoneVerified")}
                checked={profile.verification.phoneVerified}
                onCheckedChange={(v) => patchVerification("phoneVerified", v)}
                disabled={pending}
              />
              <VerifRow
                label={tDrawer("photoVerified")}
                checked={profile.verification.photoVerified}
                onCheckedChange={(v) => patchVerification("photoVerified", v)}
                disabled={pending}
              />
              <VerifRow
                label={tDrawer("idVerified")}
                checked={profile.verification.idVerified}
                onCheckedChange={(v) => patchVerification("idVerified", v)}
                disabled={pending}
              />
            </TabsContent>

            <TabsContent value="activity" className="pt-3 text-sm text-muted-foreground">
              {tDrawer("activityPlaceholder")}
            </TabsContent>

            <TabsContent value="danger" className="pt-3 text-sm space-y-3">
              <p className="text-xs text-muted-foreground">{tDrawer("dangerZoneNote")}</p>
              <div className="flex flex-wrap gap-2">
                {profile.status !== "active" && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => patchStatus("active")}>
                    {t("approve")}
                  </Button>
                )}
                {profile.status !== "suspended" && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => patchStatus("suspended")}>
                    {t("suspend")}
                  </Button>
                )}
                {profile.status !== "hidden" && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => patchStatus("hidden")}>
                    {t("hide")}
                  </Button>
                )}
              </div>
              <div className="rounded-md border border-danger/30 bg-danger/5 p-4">
                <h3 className="text-sm font-semibold text-danger">{tDrawer("dangerZone")}</h3>
                <Button
                  className="mt-3"
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 /> {tDrawer("deleteProfile")}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <SheetFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tCommon("close")}
          </Button>
        </SheetFooter>
      </SheetContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={tDrawer("deleteProfile")}
        description={tDrawer("dangerZoneNote")}
        confirmLabel={tCommon("delete")}
        confirmWord={profile.displayName}
        onConfirm={handleDelete}
      />
    </Sheet>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground text-right max-w-[60%] truncate", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

function VerifRow({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span>{label}</span>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(Boolean(v))}
        disabled={disabled}
      />
    </label>
  );
}
