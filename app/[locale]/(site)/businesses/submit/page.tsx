import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { fetchCategories } from "@/lib/admin/data/business-taxonomies";
import { SubmitBusinessForm } from "@/components/businesses/SubmitBusinessForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("businesses.submit");
  return { title: t("title"), description: t("subtitle") };
}

export default async function SubmitBusinessPage() {
  const [t, { categories }] = await Promise.all([
    getTranslations("businesses.submit"),
    fetchCategories(),
  ]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t("guideline")}
        </p>
      </header>
      <div className="mt-6">
        <SubmitBusinessForm categories={categories} />
      </div>
    </div>
  );
}
