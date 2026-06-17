import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSiteSession } from "@/lib/auth/session";
import { listMySubmissions, type MySubmission } from "@/lib/profile/submissions";
import { formatRelative } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profileSubmissions");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

type StatusKey =
  | "under_review"
  | "pending_review"
  | "draft"
  | "published"
  | "approved"
  | "rejected"
  | "cancelled";

const STATUS_VARIANT: Record<StatusKey, string> = {
  under_review: "bg-warning/10 text-warning border-warning/30",
  pending_review: "bg-warning/10 text-warning border-warning/30",
  draft: "bg-muted text-muted-foreground border-border",
  published: "bg-success/10 text-success border-success/30",
  approved: "bg-success/10 text-success border-success/30",
  rejected: "bg-danger/10 text-danger border-danger/30",
  cancelled: "bg-danger/10 text-danger border-danger/30",
};

export default async function MySubmissionsPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/profile/submissions");

  const t = await getTranslations("profileSubmissions");
  const tNav = await getTranslations("profileNav");

  const { events, businesses, mosques } = await listMySubmissions(session.uid);

  const total = events.length + businesses.length + mosques.length;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {tNav("items.submissions")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </header>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            title={t("sections.events")}
            empty={t("emptySection")}
            items={events}
            statusLabel={(s) => t(`statuses.${s}` as `statuses.${StatusKey}`)}
            openLabel={t("viewLive")}
          />
          <Section
            title={t("sections.businesses")}
            empty={t("emptySection")}
            items={businesses}
            statusLabel={(s) => t(`statuses.${s}` as `statuses.${StatusKey}`)}
            openLabel={t("viewLive")}
          />
          <Section
            title={t("sections.mosques")}
            empty={t("emptySection")}
            items={mosques}
            statusLabel={(s) => t(`statuses.${s}` as `statuses.${StatusKey}`)}
            openLabel={t("viewLive")}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  items,
  statusLabel,
  openLabel,
}: {
  title: string;
  empty: string;
  items: MySubmission[];
  statusLabel: (status: StatusKey) => string;
  openLabel: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="ms-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {items.length}
        </span>
      </h2>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={`${item.entity}-${item.id}`}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-base font-medium text-foreground">
                    {item.title}
                  </h3>
                  <span
                    className={
                      "shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
                      STATUS_VARIANT[item.status as StatusKey]
                    }
                  >
                    {statusLabel(item.status as StatusKey)}
                  </span>
                </div>
                {item.subtitle && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{item.subtitle}</p>
                )}
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatRelative(item.submittedAt)}</span>
                  {item.liveUrl && (
                    <Link
                      href={item.liveUrl}
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      {openLabel}
                      <ChevronRight className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
