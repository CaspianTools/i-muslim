"use client";

import { useTranslations } from "next-intl";
import { CommentsPopupButton } from "@/components/comments/CommentsPopupButton";
import type { CommentItemMeta } from "@/types/comments";

interface Props {
  collectionId: string;
  bookNumber: number;
  hadithNumber: number;
  reference: string;
  locale: string;
  signedIn: boolean;
  currentUid: string | null;
  initialCount: number;
  className?: string;
}

export function HadithCommentsButton({
  collectionId,
  bookNumber,
  hadithNumber,
  reference,
  locale,
  signedIn,
  currentUid,
  initialCount,
  className,
}: Props) {
  const t = useTranslations("comments");
  const entityId = `${collectionId}:${hadithNumber}`;
  void bookNumber;
  const itemMeta: CommentItemMeta = {
    title: reference,
    subtitle: null,
    href: `/hadith/${collectionId}/${hadithNumber}`,
    locale,
  };

  return (
    <CommentsPopupButton
      entityType="hadith"
      entityId={entityId}
      itemMeta={itemMeta}
      signedIn={signedIn}
      currentUid={currentUid}
      initialCount={initialCount}
      dialogTitle={t("hadithDialogTitle", { reference })}
      triggerAriaLabel={t("hadithButtonAria", { count: initialCount })}
      className={className}
    />
  );
}
