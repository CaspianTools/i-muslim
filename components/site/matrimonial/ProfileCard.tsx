"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ageFromDob } from "@/lib/matrimonial/age";
import { initials } from "@/lib/utils";
import type { MatrimonialProfile } from "@/types/matrimonial";

export function ProfileCard({ profile }: { profile: MatrimonialProfile }) {
  const tCard = useTranslations("matrimonial.browse.card");
  const tMadhhabs = useTranslations("matrimonial.madhhabs");
  const tPrayer = useTranslations("matrimonial.prayer");
  return (
    <Link
      href={`/matrimonial/${profile.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <div className="flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground">{profile.displayName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {tCard("ageCity", { age: ageFromDob(profile.dateOfBirth), city: profile.city })}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="neutral">{tMadhhabs(profile.madhhab)}</Badge>
        <Badge variant="neutral">{tPrayer(profile.prayerCommitment)}</Badge>
        <Badge variant="neutral">{profile.country}</Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{profile.bio}</p>
    </Link>
  );
}
