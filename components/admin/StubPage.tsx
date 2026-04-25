import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";
import { findNavItem, type NavItemKey } from "@/lib/admin/nav";

interface StubPageProps {
  href: string;
}

export async function StubPage({ href }: StubPageProps) {
  const item = findNavItem(href);
  const Icon = item?.icon ?? FileQuestion;
  const tNav = await getTranslations("sidebar.items");
  const tStub = await getTranslations("stub");
  const title = item ? tNav(item.labelKey as NavItemKey) : tStub("comingSoon");

  return (
    <div>
      <PageHeader title={title} />
      <EmptyState icon={Icon} title={tStub("comingSoon")} description={tStub("description")} />
    </div>
  );
}
