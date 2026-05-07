"use client";

import Link from "next/link";
import { Inbox, Mail, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelative, initials } from "@/lib/utils";
import type {
  MatrimonialInterest,
  MatrimonialProfile,
} from "@/types/matrimonial";

interface Props {
  viewerId: string;
  incoming: MatrimonialInterest[];
  outgoing: MatrimonialInterest[];
  matchedIds: string[];
  profilesById: Record<string, MatrimonialProfile>;
}

export function InboxTabs({ viewerId, incoming, outgoing, matchedIds, profilesById }: Props) {
  const t = useTranslations("matrimonial.inbox");

  const incomingActive = incoming.filter((i) => i.status === "pending");
  const matchedProfiles = matchedIds
    .map((id) => profilesById[id])
    .filter((p): p is MatrimonialProfile => Boolean(p));

  return (
    <Tabs defaultValue="incoming" className="space-y-4">
      <TabsList>
        <TabsTrigger value="incoming">
          {t("tabIncoming")}{" "}
          {incomingActive.length > 0 && <Badge variant="accent" className="ml-1">{incomingActive.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="sent">{t("tabSent")}</TabsTrigger>
        <TabsTrigger value="matches">
          {t("tabMatches")}{" "}
          {matchedProfiles.length > 0 && <Badge variant="success" className="ml-1">{matchedProfiles.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="incoming">
        {incoming.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" />}
            title={t("emptyIncoming")}
            description={t("emptyIncomingHint")}
            actions={
              <Button asChild size="sm" variant="secondary">
                <Link href="/matrimonial/browse">{t("browseProfiles")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {incoming.map((i) => (
              <Row
                key={i.id}
                profile={profilesById[i.fromUserId]}
                label={t("receivedAt", { date: formatRelative(i.createdAt) })}
                href={`/matrimonial/${i.fromUserId}`}
                action={t("openProfile")}
              />
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="sent">
        {outgoing.length === 0 ? (
          <EmptyState
            icon={<Mail className="size-5" />}
            title={t("emptySent")}
            description={t("emptySentHint")}
            actions={
              <Button asChild size="sm" variant="secondary">
                <Link href="/matrimonial/browse">{t("browseProfiles")}</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {outgoing.map((i) => (
              <Row
                key={i.id}
                profile={profilesById[i.toUserId]}
                label={t("sentAt", { date: formatRelative(i.createdAt) })}
                href={`/matrimonial/${i.toUserId}`}
                action={t("openProfile")}
              />
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="matches">
        {matchedProfiles.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title={t("emptyMatches")}
            description={t("emptyMatchesHint")}
          />
        ) : (
          <ul className="space-y-2">
            {matchedProfiles.map((p) => (
              <Row
                key={p.id}
                profile={p}
                label={t("continueConversation")}
                href={`/matrimonial/${p.id}`}
                action={t("openProfile")}
              />
            ))}
          </ul>
        )}
      </TabsContent>

      <input type="hidden" data-viewer={viewerId} />
    </Tabs>
  );
}

function Row({
  profile,
  label,
  href,
  action,
}: {
  profile: MatrimonialProfile | undefined;
  label: string;
  href: string;
  action: string;
}) {
  if (!profile) return null;
  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      <Avatar className="size-10">
        <AvatarFallback>{initials(profile.displayName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{profile.displayName}</div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
      </div>
      <Button asChild size="sm" variant="secondary">
        <Link href={href}>{action}</Link>
      </Button>
    </li>
  );
}

