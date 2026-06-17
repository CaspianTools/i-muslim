import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fetchCategories } from "@/lib/admin/data/business-taxonomies";
import { SubmitBusinessForm } from "@/components/businesses/SubmitBusinessForm";
import { getSiteSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses.submit");
  return {
    title: t("title"),
    description: t("subtitle"),
    robots: { index: false, follow: false },
  };
}

export default async function SubmitBusinessPage() {
  const session = await getSiteSession();
  if (!session) redirect("/login?callbackUrl=/businesses/submit");

  const [t, { categories }] = await Promise.all([
    getTranslations("businesses.submit"),
    fetchCategories(),
  ]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <div className="mt-6">
        <SubmitBusinessForm categories={categories} userEmail={session.email} />
      </div>
    </div>
  );
}
