import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Flag, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { getSiteSession } from "@/lib/auth/session";
import { listMyComments } from "@/lib/profile/comments";
import { formatRelative } from "@/lib/utils";
import type { CommentRecord } from "@/types/comments";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profileComments");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

function statusVariant(s: CommentRecord["status"]): "success" | "warning" | "danger" | "neutral" {
  if (s === "visible") return "success";
  if (s === "auto_hidden") return "warning";
  if (s === "hidden" || s === "deleted") return "danger";
  return "neutral";
}

export default async function MyCommentsPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/profile/comments");

  const t = await getTranslations("profileComments");
  const tStatuses = await getTranslations("comments.statuses");
  const tEntities = await getTranslations("commentsAdmin.entityTypes");
  const tNav = await getTranslations("profileNav");

  const comments = await listMyComments(session.uid, { limit: 200 });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {tNav("items.comments")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </header>

      {comments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge variant="neutral" className="mr-2">
                    {tEntities(c.entityType)}
                  </Badge>
                  {c.itemMeta.href ? (
                    <Link
                      href={c.itemMeta.href}
                      className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                    >
                      <span className="truncate max-w-[420px]">{c.itemMeta.title}</span>
                      <ChevronRight className="size-3" />
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-foreground">
                      {c.itemMeta.title || c.entityId}
                    </span>
                  )}
                </div>
                <Badge variant={statusVariant(c.status)}>{tStatuses(c.status)}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-foreground">
                {c.body || <em className="text-muted-foreground">{t("emptyBody")}</em>}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{formatRelative(c.createdAt)}</span>
                {c.editedAt && <span>· {t("edited")}</span>}
                {c.replyCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="size-3" />
                    {t("replies", { count: c.replyCount })}
                  </span>
                )}
                {c.flagCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <Flag className="size-3" />
                    {t("flags", { count: c.flagCount })}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
