import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
  backHref?: string;
}

export async function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  backHref = "/admin",
}: EmptyStateProps) {
  const t = await getTranslations("stub");
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {backHref && (
          <Button variant="secondary" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="rtl:rotate-180" /> {t("backToDashboard")}
            </Link>
          </Button>
        )}
        {action && (
          <Button size="sm" asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
