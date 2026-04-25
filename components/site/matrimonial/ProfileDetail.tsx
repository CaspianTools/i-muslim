import Link from "next/link";
import { ArrowLeft, BadgeCheck, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ageFromDob } from "@/lib/matrimonial/age";
import { getVisiblePhotos } from "@/lib/matrimonial/photos";
import { initials } from "@/lib/utils";
import { InterestButton } from "./InterestButton";
import { ReportDialog } from "./ReportDialog";
import type { MatrimonialInterest, MatrimonialProfile } from "@/types/matrimonial";

interface Props {
  viewerId: string;
  target: MatrimonialProfile;
  myInterest: MatrimonialInterest | null;
  theirInterest: MatrimonialInterest | null;
  matched: boolean;
  backLabel: string;
}

export async function ProfileDetail({
  viewerId,
  target,
  myInterest,
  theirInterest,
  matched,
  backLabel,
}: Props) {
  const t = await getTranslations("matrimonial.profile");
  const tMadhhabs = await getTranslations("matrimonial.madhhabs");
  const tPrayer = await getTranslations("matrimonial.prayer");
  const tHijab = await getTranslations("matrimonial.hijab");
  const tBeard = await getTranslations("matrimonial.beard");
  const tPolygamy = await getTranslations("matrimonial.polygamy");
  const tMarital = await getTranslations("matrimonial.marital");
  const tWants = await getTranslations("matrimonial.wantsChildren");
  const tEducation = await getTranslations("matrimonial.education");
  const tCommon = await getTranslations("common");

  const visiblePhotos = getVisiblePhotos(target, matched);
  const age = ageFromDob(target.dateOfBirth);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/matrimonial/browse">
          <ArrowLeft className="rtl:rotate-180" /> {backLabel}
        </Link>
      </Button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar className="size-20">
          {visiblePhotos[0] && <AvatarImage src={visiblePhotos[0].url} alt="" />}
          <AvatarFallback>{initials(target.displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-2xl font-semibold tracking-tight text-foreground">
            {target.displayName}
            {target.verification.emailVerified && (
              <BadgeCheck className="size-5 text-primary" />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("ageCity", { age, city: target.city, country: target.country })}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="neutral">{tMadhhabs(target.madhhab)}</Badge>
            <Badge variant="neutral">{tPrayer(target.prayerCommitment)}</Badge>
            {target.gender === "female" && target.hijab !== "na" && (
              <Badge variant="neutral">{tHijab(target.hijab)}</Badge>
            )}
            {target.gender === "male" && target.beard !== "na" && (
              <Badge variant="neutral">{tBeard(target.beard)}</Badge>
            )}
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-5">
        <InterestButton
          targetId={target.id}
          myInterest={myInterest}
          theirInterest={theirInterest}
          matched={matched}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("sectionAbout")}
        </h2>
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">
          {target.bio}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("sectionDeen")}
        </h2>
        <div className="grid gap-2 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
          <Row label="Madhhab" value={tMadhhabs(target.madhhab)} />
          <Row label="Sect" value={target.sect} />
          <Row label="Prayer" value={tPrayer(target.prayerCommitment)} />
          {target.gender === "female" && target.hijab !== "na" && (
            <Row label="Hijab" value={tHijab(target.hijab)} />
          )}
          {target.gender === "male" && target.beard !== "na" && (
            <Row label="Beard" value={tBeard(target.beard)} />
          )}
          <Row label="Polygamy" value={tPolygamy(target.polygamyStance)} />
          <Row label="Revert" value={target.revert ? tCommon("yes") : tCommon("no")} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("sectionBackground")}
        </h2>
        <div className="grid gap-2 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
          <Row label="Education" value={tEducation(target.education)} />
          <Row label="Profession" value={target.profession ?? "—"} />
          <Row label="Marital history" value={tMarital(target.maritalHistory)} />
          <Row label="Has children" value={target.hasChildren ? tCommon("yes") : tCommon("no")} />
          <Row label="Wants children" value={tWants(target.wantsChildren)} />
          <Row label="Languages" value={target.languages.join(", ") || "—"} />
        </div>
      </section>

      {!matched && (
        <section className="rounded-lg border border-dashed border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            {t("photosLocked")}
          </div>
        </section>
      )}

      {matched && visiblePhotos.length > 1 && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visiblePhotos.slice(1).map((p) => (
            <img
              key={p.id}
              src={p.url}
              alt=""
              className="aspect-square w-full rounded-md object-cover"
            />
          ))}
        </section>
      )}

      <div className="flex justify-end">
        <ReportDialog targetId={target.id} />
      </div>

      <input type="hidden" data-viewer={viewerId} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
